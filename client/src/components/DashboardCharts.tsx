import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { usePrefersReducedMotion } from '@/lib/performance';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityData {
  day: string;
  commits: number;
  deploys: number;
  builds: number;
}

interface StorageData {
  name: string;
  value: number;
  color: string;
}

const DashboardCharts = memo(function DashboardCharts({ projects }: { projects: any[] }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Real API calls - no mock data
  const { data: weeklyActivityData = [], isLoading: activityLoading, error: activityError } = useQuery<ActivityData[]>({
    queryKey: ['/api/analytics/weekly-activity'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/weekly-activity', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch activity data');
      return response.json();
    }
  });

  const { data: storageData = [], isLoading: storageLoading, error: storageError } = useQuery<StorageData[]>({
    queryKey: ['/api/analytics/storage'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/storage', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch storage data');
      return response.json();
    }
  });
  
  const chartAnimation = useMemo(() => ({
    animationBegin: prefersReducedMotion ? 0 : 0,
    animationDuration: prefersReducedMotion ? 0 : 800,
    animationEasing: 'ease-out' as const
  }), [prefersReducedMotion]);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 contain-layout">
      {/* Activity Chart */}
      <Card className="contain-paint">
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : activityError ? (
            <div className="w-full h-[300px] flex items-center justify-center text-destructive">
              Failed to load activity data
            </div>
          ) : weeklyActivityData.length === 0 ? (
            <div className="w-full h-[300px] flex items-center justify-center text-muted-foreground">
              No activity data available
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={weeklyActivityData}>
              <defs>
                <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBuilds" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="commits"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorCommits)"
                strokeWidth={2}
                {...chartAnimation}
              />
              <Area
                type="monotone"
                dataKey="builds"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorBuilds)"
                strokeWidth={2}
                {...chartAnimation}
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      
      {/* Storage Chart */}
      <Card className="contain-paint">
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {storageLoading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : storageError ? (
            <div className="w-full h-[300px] flex items-center justify-center text-destructive">
              Failed to load storage data
            </div>
          ) : storageData.length === 0 ? (
            <div className="w-full h-[300px] flex items-center justify-center text-muted-foreground">
              No storage data available
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={storageData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${percent != null ? (percent * 100).toFixed(0) : 0}%`}
                {...chartAnimation}
              >
                {storageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default DashboardCharts;