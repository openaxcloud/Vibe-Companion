import { Suspense, ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, BarChart3 } from 'lucide-react';
import { instrumentedLazy } from '@/utils/instrumented-lazy';

interface ChartFallbackProps {
  height?: string | number;
  width?: string | number;
}

function ChartFallback({ height = '300px', width = '100%' }: ChartFallbackProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center bg-muted/20 rounded-md border"
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width
      }}
    >
      <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mb-2" />
      <span className="text-[13px] text-muted-foreground">Loading chart...</span>
    </div>
  );
}

export const LazyResponseTimeChart = instrumentedLazy(() => 
  import('@/components/monitoring/ResponseTimeChart').then(mod => ({ default: mod.ResponseTimeChart })), 'ResponseTimeChart'
);

export const LazyErrorRateChart = instrumentedLazy(() => 
  import('@/components/monitoring/ErrorRateChart').then(mod => ({ default: mod.ErrorRateChart })), 'ErrorRateChart'
);

export const LazyThroughputChart = instrumentedLazy(() => 
  import('@/components/monitoring/ThroughputChart').then(mod => ({ default: mod.ThroughputChart })), 'ThroughputChart'
);

export const LazyResourceUsageChart = instrumentedLazy(() => 
  import('@/components/monitoring/ResourceUsageChart').then(mod => ({ default: mod.ResourceUsageChart })), 'ResourceUsageChart'
);

export const LazyCustomMetricChart = instrumentedLazy(() => 
  import('@/components/monitoring/CustomMetricChart').then(mod => ({ default: mod.CustomMetricChart })), 'CustomMetricChart'
);

export const LazyDashboardCharts = instrumentedLazy(() => 
  import('@/components/DashboardCharts').then(mod => ({ default: mod.default })), 'DashboardCharts'
);

export const LazyDeploymentMetrics = instrumentedLazy(() => 
  import('@/components/deployment/DeploymentMetrics').then(mod => ({ default: mod.DeploymentMetrics })), 'DeploymentMetrics'
);

export const LazyAIUsageDashboard = instrumentedLazy(() => 
  import('@/components/AIUsageDashboard').then(mod => ({ default: mod.AIUsageDashboard })), 'AIUsageDashboard'
);

export const LazyPerformanceDashboard = instrumentedLazy(() => 
  import('@/components/monitoring/PerformanceDashboard').then(mod => ({ default: mod.PerformanceDashboard })), 'PerformanceDashboard'
);

interface LazyChartWrapperProps {
  Component: ComponentType<any>;
  fallbackHeight?: string | number;
  fallbackWidth?: string | number;
  [key: string]: any;
}

export function LazyChartWrapper({ 
  Component, 
  fallbackHeight = '300px',
  fallbackWidth = '100%',
  ...props 
}: LazyChartWrapperProps) {
  return (
    <Suspense fallback={<ChartFallback height={fallbackHeight} width={fallbackWidth} />}>
      <Component {...props} />
    </Suspense>
  );
}

export function withLazyChart<P extends Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallbackHeight?: string | number,
  fallbackWidth?: string | number,
  moduleName?: string
) {
  const LazyComponent = instrumentedLazy(importFn, moduleName || 'ChartComponent');
  
  return function LazyChartHOC(props: P) {
    return (
      <Suspense fallback={<ChartFallback height={fallbackHeight} width={fallbackWidth} />}>
        <LazyComponent {...props as any} />
      </Suspense>
    );
  };
}
