// @ts-nocheck
// Performance Budget Monitoring System

import performanceMonitor, { getWebVitals } from './performance';

// Performance budget thresholds
interface PerformanceBudget {
  // Bundle sizes (in KB)
  bundleSize: {
    js: number;
    css: number;
    total: number;
  };
  // Web Vitals (in ms/score)
  webVitals: {
    lcp: number;  // Largest Contentful Paint
    fid: number;  // First Input Delay
    cls: number;  // Cumulative Layout Shift
    fcp: number;  // First Contentful Paint
    ttfb: number; // Time to First Byte
    inp: number;  // Interaction to Next Paint
  };
  // Resource counts
  resources: {
    scripts: number;
    stylesheets: number;
    images: number;
    fonts: number;
    total: number;
  };
  // Network metrics
  network: {
    requests: number;
    totalSize: number; // in KB
    totalTime: number; // in ms
  };
  // Custom metrics
  custom: {
    timeToInteractive: number;
    domContentLoaded: number;
    loadComplete: number;
    longTasks: number; // count
  };
}

// Default performance budget
const defaultBudget: PerformanceBudget = {
  bundleSize: {
    js: 200,    // 200KB for JS
    css: 50,    // 50KB for CSS
    total: 300, // 300KB total
  },
  webVitals: {
    lcp: 2500,  // 2.5s
    fid: 100,   // 100ms
    cls: 0.1,   // 0.1 score
    fcp: 1500,  // 1.5s
    ttfb: 800,  // 800ms
    inp: 200,   // 200ms
  },
  resources: {
    scripts: 10,
    stylesheets: 5,
    images: 50,
    fonts: 5,
    total: 100,
  },
  network: {
    requests: 50,
    totalSize: 1024,  // 1MB
    totalTime: 5000,  // 5s
  },
  custom: {
    timeToInteractive: 3000, // 3s
    domContentLoaded: 2000,  // 2s
    loadComplete: 4000,      // 4s
    longTasks: 5,           // max 5 long tasks
  },
};

// Budget violation severity
enum ViolationSeverity {
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Budget violation interface
interface BudgetViolation {
  metric: string;
  budget: number;
  actual: number;
  difference: number;
  percentageOver: number;
  severity: ViolationSeverity;
  message: string;
  timestamp: number;
}

// Performance report interface
interface PerformanceReport {
  violations: BudgetViolation[];
  metrics: Partial<PerformanceBudget>;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
  timestamp: number;
}

class PerformanceBudgetMonitor {
  private budget: PerformanceBudget;
  private violations: BudgetViolation[] = [];
  private reportCallbacks: ((report: PerformanceReport) => void)[] = [];
  private monitoringInterval: number | null = null;

  constructor(budget?: Partial<PerformanceBudget>) {
    this.budget = this.mergeBudgets(defaultBudget, budget);
  }

  private mergeBudgets(
    defaultBudget: PerformanceBudget,
    customBudget?: Partial<PerformanceBudget>
  ): PerformanceBudget {
    if (!customBudget) return defaultBudget;
    
    return {
      bundleSize: { ...defaultBudget.bundleSize, ...customBudget.bundleSize },
      webVitals: { ...defaultBudget.webVitals, ...customBudget.webVitals },
      resources: { ...defaultBudget.resources, ...customBudget.resources },
      network: { ...defaultBudget.network, ...customBudget.network },
      custom: { ...defaultBudget.custom, ...customBudget.custom },
    };
  }

  // Start monitoring
  public startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    // Initial check
    this.checkBudget();

    // Set up periodic checks
    this.monitoringInterval = window.setInterval(() => {
      this.checkBudget();
    }, intervalMs);

    // Monitor page lifecycle events
    this.monitorPageLifecycle();
  }

  // Stop monitoring
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Check budget compliance
  public async checkBudget(): Promise<PerformanceReport> {
    this.violations = [];
    const metrics = await this.collectMetrics();
    
    // Check bundle sizes
    this.checkBundleSizes(metrics.bundleSize);
    
    // Check Web Vitals
    this.checkWebVitals(metrics.webVitals);
    
    // Check resource counts
    this.checkResources(metrics.resources);
    
    // Check network metrics
    this.checkNetwork(metrics.network);
    
    // Check custom metrics
    this.checkCustomMetrics(metrics.custom);
    
    // Generate report
    const report = this.generateReport(metrics);
    
    // Notify callbacks
    this.reportCallbacks.forEach(callback => callback(report));
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      this.logReport(report);
    }
    
    return report;
  }

  // Collect current metrics
  private async collectMetrics(): Promise<Partial<PerformanceBudget>> {
    const metrics: Partial<PerformanceBudget> = {};
    
    // Collect bundle sizes
    metrics.bundleSize = await this.collectBundleSizes();
    
    // Collect Web Vitals
    metrics.webVitals = this.collectWebVitals();
    
    // Collect resource metrics
    metrics.resources = this.collectResourceMetrics();
    
    // Collect network metrics
    metrics.network = this.collectNetworkMetrics();
    
    // Collect custom metrics
    metrics.custom = this.collectCustomMetrics();
    
    return metrics;
  }

  private async collectBundleSizes(): Promise<PerformanceBudget['bundleSize']> {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    let jsSize = 0;
    let cssSize = 0;
    
    resources.forEach(resource => {
      const size = resource.transferSize / 1024; // Convert to KB
      
      if (resource.name.includes('.js')) {
        jsSize += size;
      } else if (resource.name.includes('.css')) {
        cssSize += size;
      }
    });
    
    return {
      js: Math.round(jsSize),
      css: Math.round(cssSize),
      total: Math.round(jsSize + cssSize),
    };
  }

  private collectWebVitals(): Partial<PerformanceBudget['webVitals']> {
    const vitals = getWebVitals();
    
    return {
      lcp: vitals.lcp,
      fid: vitals.fid,
      cls: vitals.cls,
      fcp: vitals.fcp,
      ttfb: vitals.ttfb,
      inp: vitals.inp,
    };
  }

  private collectResourceMetrics(): PerformanceBudget['resources'] {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    const counts = {
      scripts: 0,
      stylesheets: 0,
      images: 0,
      fonts: 0,
      total: resources.length,
    };
    
    resources.forEach(resource => {
      if (resource.name.includes('.js')) {
        counts.scripts++;
      } else if (resource.name.includes('.css')) {
        counts.stylesheets++;
      } else if (resource.name.match(/\.(jpg|jpeg|png|gif|svg|webp)/i)) {
        counts.images++;
      } else if (resource.name.match(/\.(woff|woff2|ttf|otf|eot)/i)) {
        counts.fonts++;
      }
    });
    
    return counts;
  }

  private collectNetworkMetrics(): PerformanceBudget['network'] {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    let totalSize = 0;
    let totalTime = 0;
    
    resources.forEach(resource => {
      totalSize += resource.transferSize / 1024; // Convert to KB
      totalTime += resource.duration;
    });
    
    return {
      requests: resources.length,
      totalSize: Math.round(totalSize),
      totalTime: Math.round(totalTime),
    };
  }

  private collectCustomMetrics(): Partial<PerformanceBudget['custom']> {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const longTasks = (performance as any).getEntriesByType?.('longtask') || [];
    
    return {
      timeToInteractive: navigation?.domInteractive - navigation?.fetchStart,
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
      loadComplete: navigation?.loadEventEnd - navigation?.fetchStart,
      longTasks: longTasks.length,
    };
  }

  // Check specific metrics against budget
  private checkBundleSizes(actual?: PerformanceBudget['bundleSize']): void {
    if (!actual) return;
    
    this.checkMetric('Bundle JS', this.budget.bundleSize.js, actual.js, 'KB');
    this.checkMetric('Bundle CSS', this.budget.bundleSize.css, actual.css, 'KB');
    this.checkMetric('Bundle Total', this.budget.bundleSize.total, actual.total, 'KB');
  }

  private checkWebVitals(actual?: Partial<PerformanceBudget['webVitals']>): void {
    if (!actual) return;
    
    if (actual.lcp !== undefined) {
      this.checkMetric('LCP', this.budget.webVitals.lcp, actual.lcp, 'ms');
    }
    if (actual.fid !== undefined) {
      this.checkMetric('FID', this.budget.webVitals.fid, actual.fid, 'ms');
    }
    if (actual.cls !== undefined) {
      this.checkMetric('CLS', this.budget.webVitals.cls, actual.cls, 'score');
    }
    if (actual.fcp !== undefined) {
      this.checkMetric('FCP', this.budget.webVitals.fcp, actual.fcp, 'ms');
    }
    if (actual.ttfb !== undefined) {
      this.checkMetric('TTFB', this.budget.webVitals.ttfb, actual.ttfb, 'ms');
    }
    if (actual.inp !== undefined) {
      this.checkMetric('INP', this.budget.webVitals.inp, actual.inp, 'ms');
    }
  }

  private checkResources(actual?: PerformanceBudget['resources']): void {
    if (!actual) return;
    
    this.checkMetric('Scripts', this.budget.resources.scripts, actual.scripts, 'files');
    this.checkMetric('Stylesheets', this.budget.resources.stylesheets, actual.stylesheets, 'files');
    this.checkMetric('Images', this.budget.resources.images, actual.images, 'files');
    this.checkMetric('Fonts', this.budget.resources.fonts, actual.fonts, 'files');
    this.checkMetric('Total Resources', this.budget.resources.total, actual.total, 'files');
  }

  private checkNetwork(actual?: PerformanceBudget['network']): void {
    if (!actual) return;
    
    this.checkMetric('Requests', this.budget.network.requests, actual.requests, 'requests');
    this.checkMetric('Network Size', this.budget.network.totalSize, actual.totalSize, 'KB');
    this.checkMetric('Network Time', this.budget.network.totalTime, actual.totalTime, 'ms');
  }

  private checkCustomMetrics(actual?: Partial<PerformanceBudget['custom']>): void {
    if (!actual) return;
    
    if (actual.timeToInteractive !== undefined) {
      this.checkMetric('Time to Interactive', this.budget.custom.timeToInteractive, actual.timeToInteractive, 'ms');
    }
    if (actual.domContentLoaded !== undefined) {
      this.checkMetric('DOM Content Loaded', this.budget.custom.domContentLoaded, actual.domContentLoaded, 'ms');
    }
    if (actual.loadComplete !== undefined) {
      this.checkMetric('Load Complete', this.budget.custom.loadComplete, actual.loadComplete, 'ms');
    }
    if (actual.longTasks !== undefined) {
      this.checkMetric('Long Tasks', this.budget.custom.longTasks, actual.longTasks, 'tasks');
    }
  }

  private checkMetric(name: string, budget: number, actual: number, unit: string): void {
    if (actual <= budget) return;
    
    const difference = actual - budget;
    const percentageOver = ((difference / budget) * 100);
    
    const severity = this.getSeverity(percentageOver);
    
    this.violations.push({
      metric: name,
      budget,
      actual,
      difference,
      percentageOver,
      severity,
      message: `${name} is ${difference.toFixed(2)}${unit} over budget (${percentageOver.toFixed(1)}% over)`,
      timestamp: Date.now(),
    });
  }

  private getSeverity(percentageOver: number): ViolationSeverity {
    if (percentageOver > 50) return ViolationSeverity.CRITICAL;
    if (percentageOver > 20) return ViolationSeverity.ERROR;
    return ViolationSeverity.WARNING;
  }

  private generateReport(metrics: Partial<PerformanceBudget>): PerformanceReport {
    const score = this.calculateScore();
    const grade = this.calculateGrade(score);
    const recommendations = this.generateRecommendations();
    
    return {
      violations: [...this.violations],
      metrics,
      score,
      grade,
      recommendations,
      timestamp: Date.now(),
    };
  }

  private calculateScore(): number {
    if (this.violations.length === 0) return 100;
    
    let score = 100;
    
    this.violations.forEach(violation => {
      switch (violation.severity) {
        case ViolationSeverity.CRITICAL:
          score -= 20;
          break;
        case ViolationSeverity.ERROR:
          score -= 10;
          break;
        case ViolationSeverity.WARNING:
          score -= 5;
          break;
      }
    });
    
    return Math.max(0, score);
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    this.violations.forEach(violation => {
      if (violation.metric.includes('Bundle')) {
        recommendations.push('Consider code splitting and lazy loading to reduce bundle size');
      }
      if (violation.metric === 'LCP') {
        recommendations.push('Optimize largest contentful paint by preloading critical resources');
      }
      if (violation.metric === 'FID') {
        recommendations.push('Reduce JavaScript execution time to improve first input delay');
      }
      if (violation.metric === 'CLS') {
        recommendations.push('Add size attributes to images and avoid dynamic content injection');
      }
      if (violation.metric.includes('Network')) {
        recommendations.push('Implement request batching and resource compression');
      }
    });
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private monitorPageLifecycle(): void {
    // Monitor visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkBudget();
      }
    });
    
    // Monitor page unload
    window.addEventListener('beforeunload', () => {
      const report = this.generateReport({});
      this.sendReport(report);
    });
  }

  private sendReport(report: PerformanceReport): void {
    // Send report to monitoring service
    if ('sendBeacon' in navigator) {
      const data = JSON.stringify(report);
      navigator.sendBeacon('/api/monitoring/performance-budget', data);
    }
  }

  private logReport(report: PerformanceReport): void {
    const color = report.grade === 'A' ? 'green' : report.grade === 'B' ? 'blue' : 'red';
    
    console.group(`%c⚡ Performance Budget Report - Grade: ${report.grade} (${report.score}/100)`, `color: ${color}; font-weight: bold`);
    
    if (report.violations.length > 0) {
      console.group('🚫 Budget Violations:');
      report.violations.forEach(violation => {
        const icon = violation.severity === ViolationSeverity.CRITICAL ? '🔴' :
                    violation.severity === ViolationSeverity.ERROR ? '🟠' : '🟡';
      });
      console.groupEnd();
    }
    
    if (report.recommendations.length > 0) {
      console.group('💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`• ${rec}`));
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  // Subscribe to reports
  public onReport(callback: (report: PerformanceReport) => void): () => void {
    this.reportCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.reportCallbacks.indexOf(callback);
      if (index > -1) {
        this.reportCallbacks.splice(index, 1);
      }
    };
  }

  // Update budget
  public updateBudget(budget: Partial<PerformanceBudget>): void {
    this.budget = this.mergeBudgets(this.budget, budget);
  }

  // Get current budget
  public getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  // Get violations
  public getViolations(): BudgetViolation[] {
    return [...this.violations];
  }
}

// Create and export singleton instance
const budgetMonitor = new PerformanceBudgetMonitor();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  // Wait for page load
  if (document.readyState === 'complete') {
    budgetMonitor.startMonitoring();
  } else {
    window.addEventListener('load', () => {
      budgetMonitor.startMonitoring();
    });
  }
}

// Export utilities
export const checkPerformanceBudget = () => budgetMonitor.checkBudget();
export const updatePerformanceBudget = (budget: Partial<PerformanceBudget>) => budgetMonitor.updateBudget(budget);
export const onPerformanceReport = (callback: (report: PerformanceReport) => void) => budgetMonitor.onReport(callback);
export const getPerformanceViolations = () => budgetMonitor.getViolations();

export default budgetMonitor;
export type { PerformanceBudget, BudgetViolation, PerformanceReport };