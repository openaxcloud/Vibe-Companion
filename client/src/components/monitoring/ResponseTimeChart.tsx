import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock } from 'lucide-react';
import { useMemo } from 'react';

interface ResponseTimeChartProps {
  data?: any[];
  realTime?: any;
  detailed?: boolean;
}

export function ResponseTimeChart({ data, realTime, detailed }: ResponseTimeChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data.slice(-100).map((item: any) => {
      const avg = item.metric_name === 'avg_response_time' ? parseFloat(item.metric_value) : 0;
      const p95Value = item.p95 !== undefined ? parseFloat(item.p95) : avg * 1.5;
      const p99Value = item.p99 !== undefined ? parseFloat(item.p99) : avg * 2;
      
      return {
        time: new Date(item.timestamp).toLocaleTimeString(),
        avg,
        p95: p95Value,
        p99: p99Value,
      };
    });
  }, [data]);

  const currentValue = realTime?.application?.avgResponseTime || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Response Time
          </span>
          <span className="text-2xl font-bold">{currentValue.toFixed(0)}ms</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={detailed ? 400 : 300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="time" 
              className="text-[11px]"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-[11px]"
              tick={{ fill: 'currentColor' }}
              label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="avg" 
              stroke="#F26207" 
              strokeWidth={2}
              dot={false}
              name="Average"
            />
            {detailed && (
              <>
                <Line 
                  type="monotone" 
                  dataKey="p95" 
                  stroke="#F59E0B" 
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="P95"
                />
                <Line 
                  type="monotone" 
                  dataKey="p99" 
                  stroke="#EF4444" 
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  name="P99"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}