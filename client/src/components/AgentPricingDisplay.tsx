import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  FileText, 
  Code, 
  Clock, 
  Activity,
  Zap,
  TrendingUp,
  Brain
} from 'lucide-react';

interface AgentPricingDisplayProps {
  pricing?: {
    complexity: string;
    costInCents: number;
    costInDollars: string;
    effortScore: number;
  };
  metrics?: {
    filesModified: number;
    linesOfCode: number;
    tokensUsed: number;
    apiCalls: number;
    executionTimeMs: number;
  };
  checkpoint?: any;
}

export const AgentPricingDisplay: React.FC<AgentPricingDisplayProps> = ({ 
  pricing, 
  metrics,
  checkpoint 
}) => {
  if (!pricing) return null;

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-500';
      case 'moderate': return 'bg-blue-500';
      case 'complex': return 'bg-yellow-500';
      case 'very_complex': return 'bg-orange-500';
      case 'expert': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getComplexityLabel = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'Simple Task';
      case 'moderate': return 'Moderate Task';
      case 'complex': return 'Complex Task';
      case 'very_complex': return 'Very Complex Task';
      case 'expert': return 'Expert Level Task';
      default: return 'Task';
    }
  };

  const effortPercentage = (pricing.effortScore / 20) * 100; // Max effort score is 20

  return (
    <Card className="w-full border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            Agent Task Analysis
          </CardTitle>
          <Badge className={`${getComplexityColor(pricing.complexity)} text-white`}>
            {getComplexityLabel(pricing.complexity)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Display */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-[13px] text-gray-600">Task Cost</p>
              <p className="text-2xl font-bold text-gray-900">${pricing.costInDollars}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-500">Effort Score</p>
            <p className="text-[15px] font-semibold text-blue-600">{pricing.effortScore}x</p>
          </div>
        </div>

        {/* Effort Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-600">Task Complexity</span>
            <span className="text-gray-900 font-medium">{Math.round(effortPercentage)}%</span>
          </div>
          <Progress value={effortPercentage} className="h-2" />
        </div>

        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={<FileText className="h-4 w-4" />}
              label="Files Modified"
              value={metrics.filesModified}
              color="text-blue-600"
              bgColor="bg-blue-100"
            />
            <MetricCard
              icon={<Code className="h-4 w-4" />}
              label="Lines of Code"
              value={metrics.linesOfCode}
              color="text-green-600"
              bgColor="bg-green-100"
            />
            <MetricCard
              icon={<Zap className="h-4 w-4" />}
              label="API Calls"
              value={metrics.apiCalls}
              color="text-purple-600"
              bgColor="bg-purple-100"
            />
            <MetricCard
              icon={<Clock className="h-4 w-4" />}
              label="Execution Time"
              value={`${Math.round(metrics.executionTimeMs / 1000)}s`}
              color="text-orange-600"
              bgColor="bg-orange-100"
            />
          </div>
        )}

        {/* Token Usage */}
        {metrics && metrics.tokensUsed > 0 && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-600" />
              <span className="text-[13px] text-gray-600">Tokens Used</span>
            </div>
            <span className="text-[13px] font-medium text-gray-900">
              {metrics.tokensUsed.toLocaleString()}
            </span>
          </div>
        )}

        {/* Checkpoint Info */}
        {checkpoint && (
          <div className="pt-2 border-t">
            <p className="text-[11px] text-gray-500">
              Checkpoint #{checkpoint.id} created • Includes full AI context & database snapshot
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, bgColor }) => (
  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
    <div className={`p-2 ${bgColor} rounded-full ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-[11px] text-gray-600">{label}</p>
      <p className="text-[15px] font-semibold text-gray-900">{value}</p>
    </div>
  </div>
);

export default AgentPricingDisplay;