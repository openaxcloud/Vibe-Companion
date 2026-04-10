// @ts-nocheck
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

// Lazy load Recharts components
const RechartsComponents = instrumentedLazy(() =>
  import('recharts').then(module => ({
    default: module
  })), 'RechartsComponents'
);

// Chart skeleton that matches chart dimensions
const ChartSkeleton = ({ height = 300, width = '100%' }) => (
  <div className="w-full" style={{ height, width }}>
    <div className="flex flex-col gap-2 h-full">
      <div className="flex justify-between mb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex-1 flex items-end gap-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <Skeleton 
              className="w-full" 
              style={{ 
                height: `${Math.random() * 60 + 20}%`,
                opacity: 0.8 - (i * 0.05)
              }} 
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  </div>
);

interface LazyChartProps {
  type: 'line' | 'bar' | 'area' | 'pie';
  data: any[];
  height?: number;
  width?: string | number;
  children?: React.ReactNode;
  [key: string]: any;
}

export function LazyChart({ type, data, height = 300, width = '100%', children, ...props }: LazyChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={height} width={width} />}>
      <RechartsComponents>
        {(recharts) => {
          const { LineChart, BarChart, AreaChart, PieChart, ResponsiveContainer } = recharts;
          
          const ChartComponent = {
            line: LineChart,
            bar: BarChart,
            area: AreaChart,
            pie: PieChart
          }[type];
          
          return (
            <ResponsiveContainer width={width} height={height}>
              <ChartComponent data={data} {...props}>
                {children}
              </ChartComponent>
            </ResponsiveContainer>
          );
        }}
      </RechartsComponents>
    </Suspense>
  );
}

// Export individual lazy-loaded chart components
export const LazyLineChart = instrumentedLazy(() => 
  import('recharts').then(m => ({ default: m.LineChart })), 'LineChart'
);

export const LazyBarChart = instrumentedLazy(() => 
  import('recharts').then(m => ({ default: m.BarChart })), 'BarChart'
);

export const LazyAreaChart = instrumentedLazy(() => 
  import('recharts').then(m => ({ default: m.AreaChart })), 'AreaChart'
);

export const LazyPieChart = instrumentedLazy(() => 
  import('recharts').then(m => ({ default: m.PieChart })), 'PieChart'
);

export const LazyResponsiveContainer = instrumentedLazy(() => 
  import('recharts').then(m => ({ default: m.ResponsiveContainer })), 'ResponsiveContainer'
);