// @ts-nocheck
import { EventEmitter } from 'events';
import { db } from '../db';
import { projects, deployments } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { redisCache, CacheKeys, CacheTTL } from '../services/redis-cache.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('ab-testing');

interface ABTestConfig {
    id: string;
    projectId: number;
    name: string;
    description?: string;
    variants: ABVariant[];
    trafficSplit: Record<string, number>;
    metrics: string[];
    startDate: Date;
    endDate?: Date;
    enabled: boolean;
    targetingRules?: TargetingRule[];
}

interface ABVariant {
    id: string;
    name: string;
    deploymentId: number;
    isControl: boolean;
    customizations?: Record<string, any>;
}

interface TargetingRule {
    type: 'geo' | 'device' | 'user-segment' | 'custom';
    condition: any;
    variantId: string;
}

interface ABTestResult {
    testId: string;
    variant: string;
    metrics: Record<string, number>;
    conversions: number;
    impressions: number;
    conversionRate: number;
    confidence: number;
}

export class ABTestingService extends EventEmitter {
    constructor() {
        super();
        this.startMetricsCollection();
    }

    private async getTest(testId: string): Promise<ABTestConfig | null> {
        return await redisCache.get<ABTestConfig>(CacheKeys.abTest(testId));
    }

    private async setTest(test: ABTestConfig): Promise<void> {
        await redisCache.set(CacheKeys.abTest(test.id), test, CacheTTL.WEEK);
        await redisCache.sadd(CacheKeys.abTestsList(), test.id);
    }

    private async getResults(testId: string): Promise<ABTestResult[] | null> {
        return await redisCache.get<ABTestResult[]>(CacheKeys.abResult(testId));
    }

    private async setResults(testId: string, results: ABTestResult[]): Promise<void> {
        await redisCache.set(CacheKeys.abResult(testId), results, CacheTTL.WEEK);
    }

    private async getUserAssignment(userId: string, testId: string): Promise<string | null> {
        return await redisCache.getRaw(CacheKeys.abUserAssignment(userId, testId));
    }

    private async setUserAssignment(userId: string, testId: string, variantId: string): Promise<void> {
        await redisCache.setRaw(CacheKeys.abUserAssignment(userId, testId), variantId, CacheTTL.WEEK);
    }

    async createABTest(config: Omit<ABTestConfig, 'id'>): Promise<ABTestConfig> {
        const testId = `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const totalTraffic = Object.values(config.trafficSplit).reduce((sum, pct) => sum + pct, 0);
        if (Math.abs(totalTraffic - 100) > 0.01) {
            throw new Error('Traffic split must add up to 100%');
        }

        for (const variant of config.variants) {
            const deployment = await db.select()
                .from(deployments)
                .where(eq(deployments.id, variant.deploymentId))
                .limit(1);
            
            if (deployment.length === 0) {
                throw new Error(`Deployment ${variant.deploymentId} not found for variant ${variant.name}`);
            }
        }

        const test: ABTestConfig = {
            ...config,
            id: testId,
            enabled: config.enabled ?? true
        };

        await this.setTest(test);
        
        const initialResults = config.variants.map(v => ({
            testId,
            variant: v.id,
            metrics: Object.fromEntries(config.metrics.map(m => [m, 0])),
            conversions: 0,
            impressions: 0,
            conversionRate: 0,
            confidence: 0
        }));
        await this.setResults(testId, initialResults);

        this.emit('test:created', test);
        return test;
    }

    async updateABTest(testId: string, updates: Partial<ABTestConfig>): Promise<ABTestConfig> {
        const test = await this.getTest(testId);
        if (!test) {
            throw new Error('A/B test not found');
        }

        const updatedTest = { ...test, ...updates };
        
        if (updates.trafficSplit) {
            const totalTraffic = Object.values(updatedTest.trafficSplit).reduce((sum, pct) => sum + pct, 0);
            if (Math.abs(totalTraffic - 100) > 0.01) {
                throw new Error('Traffic split must add up to 100%');
            }
        }

        await this.setTest(updatedTest);
        this.emit('test:updated', updatedTest);
        return updatedTest;
    }

    async deleteABTest(testId: string): Promise<void> {
        const test = await this.getTest(testId);
        if (!test) {
            throw new Error('A/B test not found');
        }

        await redisCache.del(CacheKeys.abTest(testId));
        await redisCache.del(CacheKeys.abResult(testId));
        await redisCache.srem(CacheKeys.abTestsList(), testId);
        this.emit('test:deleted', testId);
    }

    async getABTest(testId: string): Promise<ABTestConfig | undefined> {
        return (await this.getTest(testId)) || undefined;
    }

    async listABTests(projectId?: number): Promise<ABTestConfig[]> {
        const testIds = await redisCache.smembers(CacheKeys.abTestsList());
        const tests: ABTestConfig[] = [];
        
        for (const id of testIds) {
            const test = await this.getTest(id);
            if (test) {
                if (projectId) {
                    if (test.projectId === projectId) tests.push(test);
                } else {
                    tests.push(test);
                }
            }
        }
        
        return tests;
    }

    async assignUserToVariant(testId: string, userId: string, context?: any): Promise<string> {
        const test = await this.getTest(testId);
        if (!test || !test.enabled) {
            throw new Error('A/B test not found or disabled');
        }

        const existingAssignment = await this.getUserAssignment(userId, testId);
        if (existingAssignment) {
            return existingAssignment;
        }

        if (test.targetingRules && context) {
            for (const rule of test.targetingRules) {
                if (this.evaluateTargetingRule(rule, context)) {
                    await this.setUserAssignment(userId, testId, rule.variantId);
                    return rule.variantId;
                }
            }
        }

        const variantId = this.selectVariantByTrafficSplit(test);
        await this.setUserAssignment(userId, testId, variantId);
        
        await this.trackImpression(testId, variantId);
        
        return variantId;
    }

    async trackEvent(testId: string, userId: string, eventName: string, value?: number): Promise<void> {
        const test = await this.getTest(testId);
        if (!test) return;

        const variantId = await this.getUserAssignment(userId, testId);
        if (!variantId) return;

        const results = await this.getResults(testId);
        if (!results) return;

        const variantResult = results.find(r => r.variant === variantId);
        if (!variantResult) return;

        if (test.metrics.includes(eventName)) {
            variantResult.metrics[eventName] = (variantResult.metrics[eventName] || 0) + (value || 1);
        }

        if (eventName === 'conversion' || eventName.includes('purchase') || eventName.includes('signup')) {
            variantResult.conversions++;
            variantResult.conversionRate = (variantResult.conversions / variantResult.impressions) * 100;
        }

        this.calculateConfidence(test, results);
        await this.setResults(testId, results);
        
        this.emit('event:tracked', { testId, userId, variantId, eventName, value });
    }

    async getTestResults(testId: string): Promise<ABTestResult[]> {
        const results = await this.getResults(testId);
        if (!results) {
            throw new Error('A/B test results not found');
        }

        return results;
    }

    async getWinningVariant(testId: string): Promise<{ variantId: string; confidence: number } | null> {
        const results = await this.getResults(testId);
        if (!results || results.length < 2) return null;

        const sorted = [...results].sort((a, b) => b.conversionRate - a.conversionRate);
        const winner = sorted[0];
        const test = await this.getTest(testId);
        const control = sorted.find(r => {
            const variant = test?.variants.find(v => v.id === r.variant);
            return variant?.isControl;
        });

        if (!control || winner.confidence < 95) {
            return null;
        }

        return {
            variantId: winner.variant,
            confidence: winner.confidence
        };
    }

    async promoteWinner(testId: string): Promise<void> {
        const winner = await this.getWinningVariant(testId);
        if (!winner) {
            throw new Error('No statistically significant winner');
        }

        const test = await this.getTest(testId);
        if (!test) {
            throw new Error('A/B test not found');
        }

        const winningVariant = test.variants.find(v => v.id === winner.variantId);
        if (!winningVariant) {
            throw new Error('Winning variant not found');
        }

        await db.update(projects)
            .set({ defaultDeploymentId: winningVariant.deploymentId })
            .where(eq(projects.id, test.projectId));

        test.enabled = false;
        test.endDate = new Date();
        await this.setTest(test);
        
        this.emit('winner:promoted', { testId, variantId: winner.variantId });
    }

    private selectVariantByTrafficSplit(test: ABTestConfig): string {
        const random = Math.random() * 100;
        let accumulated = 0;

        for (const [variantId, percentage] of Object.entries(test.trafficSplit)) {
            accumulated += percentage;
            if (random <= accumulated) {
                return variantId;
            }
        }

        return test.variants[0].id;
    }

    private evaluateTargetingRule(rule: TargetingRule, context: any): boolean {
        switch (rule.type) {
            case 'geo':
                return context.country === rule.condition.country ||
                       context.region === rule.condition.region;
            
            case 'device':
                return context.device === rule.condition.device ||
                       context.platform === rule.condition.platform;
            
            case 'user-segment':
                return context.segment === rule.condition.segment ||
                       context.tier === rule.condition.tier;
            
            case 'custom':
                try {
                    return this.safeEvaluateCondition(rule.condition, context);
                } catch {
                    return false;
                }
            
            default:
                return false;
        }
    }

    private safeEvaluateCondition(condition: any, context: any): boolean {
        if (typeof condition === 'object' && condition.property && condition.operator) {
            const actualValue = context[condition.property];
            const expectedValue = condition.value;
            
            switch (condition.operator) {
                case '===': case '==': case 'equals': return actualValue === expectedValue;
                case '!==': case '!=': case 'notEquals': return actualValue !== expectedValue;
                case '>': case 'gt': return actualValue > expectedValue;
                case '<': case 'lt': return actualValue < expectedValue;
                case '>=': case 'gte': return actualValue >= expectedValue;
                case '<=': case 'lte': return actualValue <= expectedValue;
                case 'contains': return String(actualValue).includes(String(expectedValue));
                case 'startsWith': return String(actualValue).startsWith(String(expectedValue));
                case 'in': return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
                default: return false;
            }
        }
        
        if (typeof condition === 'string' || typeof condition === 'function') {
            const conditionStr = typeof condition === 'function' ? condition.toString() : condition;
            
            const criticalPatterns = /\b(require|import|eval|child_process|exec|spawn|Function)\s*\(|process\b|globalThis\b|global\b|__proto__|constructor\s*\[|\.constructor\b|prototype\b|\bfs\b|Buffer\b|Reflect\b|Proxy\b/i;
            if (criticalPatterns.test(conditionStr)) {
                console.warn('[ABTesting] Blocked dangerous pattern in condition');
                return false;
            }
            
            try {
                const fn = new Function('context', `"use strict"; return !!(${conditionStr})`);
                return fn(context);
            } catch (error) {
                console.warn('[ABTesting] Condition evaluation failed:', error);
                return false;
            }
        }
        
        return false;
    }

    private async trackImpression(testId: string, variantId: string): Promise<void> {
        const results = await this.getResults(testId);
        if (!results) return;

        const variantResult = results.find(r => r.variant === variantId);
        if (variantResult) {
            variantResult.impressions++;
            await this.setResults(testId, results);
        }
    }

    private calculateConfidence(test: ABTestConfig, results: ABTestResult[]): void {
        if (!results || results.length < 2) return;

        const controlVariant = test.variants.find(v => v.isControl);
        if (!controlVariant) return;

        const controlResult = results.find(r => r.variant === controlVariant.id);
        if (!controlResult) return;

        for (const result of results) {
            if (result.variant === controlVariant.id) continue;

            const p1 = controlResult.conversionRate / 100;
            const p2 = result.conversionRate / 100;
            const n1 = controlResult.impressions;
            const n2 = result.impressions;

            if (n1 === 0 || n2 === 0) continue;

            const pooledP = (controlResult.conversions + result.conversions) / (n1 + n2);
            const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
            
            if (se === 0) continue;

            const z = Math.abs(p2 - p1) / se;
            result.confidence = this.zScoreToConfidence(z);
        }
    }

    private zScoreToConfidence(z: number): number {
        if (z >= 2.58) return 99;
        if (z >= 1.96) return 95;
        if (z >= 1.645) return 90;
        if (z >= 1.28) return 80;
        return Math.min(z * 30, 79);
    }

    private startMetricsCollection(): void {
        setInterval(async () => {
            const testIds = await redisCache.smembers(CacheKeys.abTestsList());
            for (const testId of testIds) {
                const test = await this.getTest(testId);
                if (!test || !test.enabled) continue;
                
                const now = new Date();
                if (test.endDate && now > new Date(test.endDate)) {
                    test.enabled = false;
                    await this.setTest(test);
                    continue;
                }

                this.emit('metrics:collected', { testId, timestamp: now });
            }
        }, 60000);
    }
}
