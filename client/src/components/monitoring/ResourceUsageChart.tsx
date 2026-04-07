import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Cpu, HardDrive } from 'lucide-react';
import { useMemo } from 'react';

interface ResourceUsageChartProps {
  data?: any[];
  realTime?: any;
  detailed?: boolean;
}

export function ResourceUsageChart({ data, realTime, detailed }: ResourceUsageChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    
    const grouped: Record<string, any> = {};
    
    data.forEach((item: any) => {
      const time = new Date(item.timestamp).toLocaleTimeString();
      if (!grouped[time]) {
        grouped[time] = { time };
      }
      
      if (item.metric_name === 'cpu_usage') {
        grouped[time].cpu = parseFloat(item.metric_value) * 100;
      }
      if (item.metric_name === 'memory_usage') {
        grouped[time].memory = parseFloat(item.metric_value);
      }
      if (item.metric_name === 'disk_usage') {
        grouped[time].disk = parseFloat(item.metric_value);
      }
    });
    
    return Object.values(grouped).slice(-100);
  }, [data]);

  const currentCpu = (realTime?.cpu?.usage || 0) * 100;
  const currentMemory = realTime?.memory?.usagePercent || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Resource Usage
          </span>
          <div className="flex gap-4 text-[13px]">
            <span>CPU: {currentCpu.toFixed(1)}%</span>
            <span>Memory: {currentMemory.toFixed(1)}%</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={detailed ? 400 : 300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="time" 
              className="text-[11px]"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-[11px]"
              tick={{ fill: 'currentColor' }}
              domain={[0, 100]}
              label={{ value: 'Usage (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              formatter={(value: any) => `${value?.toFixed(1)}%`}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="cpu" 
              stroke="#3B82F6" 
              fillOpacity={1}
              fill="url(#colorCpu)"
              name="CPU"
            />
            <Area 
              type="monotone" 
              dataKey="memory" 
              stroke="#10B981" 
              fillOpacity={1}
              fill="url(#colorMemory)"
              name="Memory"
            />
            {detailed && (
              <Area 
                type="monotone" 
                dataKey="disk" 
                stroke="#8B5CF6" 
                fillOpacity={1}
                fill="url(#colorDisk)"
                name="Disk"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}