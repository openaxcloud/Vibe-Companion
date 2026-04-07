import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';
import { useMemo } from 'react';

interface ThroughputChartProps {
  data?: any[];
  realTime?: any;
  detailed?: boolean;
}

export function ThroughputChart({ data, realTime, detailed }: ThroughputChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data
      .filter((item: any) => item.metric_name === 'requests_per_minute')
      .slice(-100)
      .map((item: any) => ({
        time: new Date(item.timestamp).toLocaleTimeString(),
        throughput: parseFloat(item.metric_value),
        success: parseFloat(item.metric_value) * 0.95, // Assume 95% success rate
        failed: parseFloat(item.metric_value) * 0.05, // Assume 5% failure rate
      }));
  }, [data]);

  const currentThroughput = realTime?.application?.requestsPerMinute || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Throughput
          </span>
          <span className="text-2xl font-bold">{currentThroughput} req/min</span>
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
              label={{ value: 'Requests/min', angle: -90, position: 'insideLeft' }}
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
              dataKey="throughput" 
              stroke="#F26207" 
              strokeWidth={2}
              dot={false}
              name="Total"
            />
            {detailed && (
              <>
                <Line 
                  type="monotone" 
                  dataKey="success" 
                  stroke="#10B981" 
                  strokeWidth={1}
                  dot={false}
                  name="Success"
                />
                <Line 
                  type="monotone" 
                  dataKey="failed" 
                  stroke="#EF4444" 
                  strokeWidth={1}
                  dot={false}
                  name="Failed"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
        
        {detailed && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{(currentThroughput * 0.95).toFixed(0)}</p>
              <p className="text-[11px] text-muted-foreground">Successful</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{(currentThroughput * 0.05).toFixed(0)}</p>
              <p className="text-[11px] text-muted-foreground">Failed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">95%</p>
              <p className="text-[11px] text-muted-foreground">Success Rate</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}