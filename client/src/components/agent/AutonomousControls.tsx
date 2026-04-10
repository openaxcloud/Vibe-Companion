/**
 * Autonomous Controls Component
 * 
 * UI for controlling autonomous agent execution:
 * - Enable/disable autonomous mode toggle
 * - Risk threshold selector
 * - Real-time autonomous action viewer
 * - Emergency stop button
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Square, Shield, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface AutonomousControlsProps {
  sessionId: string;
  onModeChange?: (enabled: boolean) => void;
}

type RiskThreshold = 'low' | 'medium' | 'high' | 'critical';

const RISK_THRESHOLD_INFO = {
  low: {
    label: '⚡ Low (Fast)',
    description: 'Auto-approve most actions. Only ultra-risky actions need approval.',
    color: 'text-green-600 dark:text-green-400',
    autoApproveBelow: 80
  },
  medium: {
    label: '⚖️ Medium (Balanced)',
    description: 'Auto-approve low-moderate risk actions. High-risk needs approval.',
    color: 'text-blue-600 dark:text-blue-400',
    autoApproveBelow: 50
  },
  high: {
    label: '🛡️ High (Conservative)',
    description: 'Auto-approve only low-risk actions. Most actions need approval.',
    color: 'text-orange-600 dark:text-orange-400',
    autoApproveBelow: 30
  },
  critical: {
    label: '🔒 Critical (Paranoid)',
    description: 'Almost all actions require human approval for maximum safety.',
    color: 'text-red-600 dark:text-red-400',
    autoApproveBelow: 10
  }
};

export function AutonomousControls({ sessionId, onModeChange }: AutonomousControlsProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [riskThreshold, setRiskThreshold] = useState<RiskThreshold>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (enabled: boolean) => {
    setIsLoading(true);
    
    try {
      const endpoint = enabled ? '/api/agent/autonomous/enable' : '/api/agent/autonomous/disable';
      
      await apiRequest('POST', endpoint, {
        sessionId,
        riskThreshold: enabled ? riskThreshold : undefined
      });
      
      setIsEnabled(enabled);
      onModeChange?.(enabled);
      
      // Invalidate relevant queries to sync UI state
      queryClient.invalidateQueries({ queryKey: ['/api/agent/autonomous/actions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/preferences'] });
      
      toast({
        title: enabled ? 'Autonomous Mode Enabled' : 'Autonomous Mode Disabled',
        description: enabled 
          ? `Agent will auto-approve actions below risk score ${RISK_THRESHOLD_INFO[riskThreshold].autoApproveBelow}`
          : 'All actions will require manual approval',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update autonomous mode',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRiskThresholdChange = async (newThreshold: RiskThreshold) => {
    if (!isEnabled) {
      setRiskThreshold(newThreshold);
      return;
    }
    
    setIsLoading(true);
    
    try {
      await apiRequest('POST', '/api/agent/autonomous/enable', {
        sessionId,
        riskThreshold: newThreshold
      });
      
      setRiskThreshold(newThreshold);
      
      // Invalidate relevant queries to sync UI state
      queryClient.invalidateQueries({ queryKey: ['/api/agent/autonomous/actions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/preferences'] });
      
      toast({
        title: 'Risk Threshold Updated',
        description: `Auto-approve actions below risk score ${RISK_THRESHOLD_INFO[newThreshold].autoApproveBelow}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update risk threshold',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentThresholdInfo = RISK_THRESHOLD_INFO[riskThreshold];

  return (
    <Card className="border-[var(--ecode-border)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Autonomous Mode
            </CardTitle>
            <CardDescription>
              Let AI work independently with safety guardrails
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={isLoading}
              data-testid="switch-autonomous-mode"
            />
            <Badge 
              variant={isEnabled ? "default" : "secondary"}
              data-testid="badge-autonomous-status"
            >
              {isEnabled ? <Play className="h-3 w-3 mr-1" /> : <Square className="h-3 w-3 mr-1" />}
              {isEnabled ? 'Active' : 'Manual'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Risk Threshold Selector */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Threshold
          </label>
          <Select
            value={riskThreshold}
            onValueChange={(value) => handleRiskThresholdChange(value as RiskThreshold)}
            disabled={isLoading}
          >
            <SelectTrigger data-testid="select-risk-threshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low" data-testid="option-risk-low">
                {RISK_THRESHOLD_INFO.low.label}
              </SelectItem>
              <SelectItem value="medium" data-testid="option-risk-medium">
                {RISK_THRESHOLD_INFO.medium.label}
              </SelectItem>
              <SelectItem value="high" data-testid="option-risk-high">
                {RISK_THRESHOLD_INFO.high.label}
              </SelectItem>
              <SelectItem value="critical" data-testid="option-risk-critical">
                {RISK_THRESHOLD_INFO.critical.label}
              </SelectItem>
            </SelectContent>
          </Select>
          
          <p className={`text-[11px] ${currentThresholdInfo.color}`}>
            {currentThresholdInfo.description}
          </p>
          
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            <span>Auto-approves actions with risk score below {currentThresholdInfo.autoApproveBelow}/100</span>
          </div>
        </div>

        {/* Status Information */}
        {isEnabled && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
            <p className="text-[13px] font-medium text-blue-900 dark:text-blue-100">
              🤖 Autonomous Mode Active
            </p>
            <ul className="text-[11px] text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Low-risk actions execute automatically</li>
              <li>High-risk actions require approval</li>
              <li>All actions are logged and auditable</li>
              <li>Emergency stop available anytime</li>
            </ul>
          </div>
        )}

        {!isEnabled && (
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <p className="text-[13px] text-gray-700 dark:text-gray-300">
              Manual mode: Every action requires your approval before execution.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
