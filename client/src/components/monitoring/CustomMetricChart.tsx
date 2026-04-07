import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useMemo } from 'react';

interface CustomMetricChartProps {
  data?: any[];
  customMetrics?: Record<string, number>;
}

export function CustomMetricChart({ data, customMetrics }: CustomMetricChartProps) {
  const chartData = useMemo(() => {
    if (!customMetrics) return [];
    
    return Object.entries(customMetrics).map(([key, value]) => ({
      metric: key.replace(/_/g, ' ').substring(0, 20),
      value: typeof value === 'number' ? value : 0,
      fullMark: 100,
    }));
  }, [customMetrics]);

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Custom Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No custom metrics available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Custom Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={chartData}>
            <PolarGrid strokeDasharray="3 3" className="stroke-muted" />
            <PolarAngleAxis 
              dataKey="metric" 
              className="text-[11px]"
              tick={{ fill: 'currentColor' }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]}
              className="text-[11px]"
              tick={{ fill: 'currentColor' }}
            />
            <Radar 
              name="Value" 
              dataKey="value" 
              stroke="#F26207" 
              fill="#F26207" 
              fillOpacity={0.6}
            />
          </RadarChart>
        </ResponsiveContainer>
        
        <div className="mt-4 space-y-2">
          <p className="text-[13px] font-semibold">Metric Values</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(customMetrics || {}).slice(0, 8).map(([key, value]) => (
              <div key={key} className="flex justify-between text-[11px] p-2 rounded-lg bg-muted/50">
                <span className="text-muted-foreground truncate mr-2">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="font-medium">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}