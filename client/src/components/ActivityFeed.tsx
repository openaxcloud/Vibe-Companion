import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitCommit, Package, Rocket, AlertCircle, CheckCircle } from 'lucide-react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/performance';

interface ActivityItem {
  id: number;
  type: 'deploy' | 'commit' | 'build' | 'error' | 'success';
  user: string;
  avatar: string;
  project: string;
  time: string;
  status?: 'success' | 'error' | 'pending';
  message?: string;
}

const ActivityIcon = memo(({ type }: { type: ActivityItem['type'] }) => {
  switch (type) {
    case 'deploy':
      return <Rocket className="h-4 w-4" />;
    case 'commit':
      return <GitCommit className="h-4 w-4" />;
    case 'build':
      return <Package className="h-4 w-4" />;
    case 'error':
      return <AlertCircle className="h-4 w-4" />;
    case 'success':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return null;
  }
});

const ActivityFeed = memo(function ActivityFeed() {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Fetch activity feed from API
  const { data: activityData, isLoading } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['/api/activity/feed'],
    staleTime: 30000,
    refetchInterval: 60000
  });

  const activityFeed = activityData?.activities || [];
  
  const itemVariants = useMemo(() => ({
    hidden: prefersReducedMotion ? {} : { opacity: 0, x: -20 },
    visible: prefersReducedMotion ? {} : { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3 }
    },
    exit: prefersReducedMotion ? {} : { 
      opacity: 0, 
      x: 20,
      transition: { duration: 0.2 }
    }
  }), [prefersReducedMotion]);
  
  return (
    <Card className="contain-layout">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 pr-4">
          <LazyAnimatePresence mode="popLayout">
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-[13px] text-muted-foreground text-center py-4">Loading activity...</p>
              ) : activityFeed.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-4">No recent activity</p>
              ) : activityFeed.map((item) => (
                <LazyMotionDiv
                  key={item.id}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex items-start space-x-3 gpu-accelerated"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[13px]">
                      {item.avatar}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ActivityIcon type={item.type} />
                        <span className="font-medium text-[13px]">{item.user}</span>
                        <span className="text-[13px] text-muted-foreground">
                          {item.type === 'deploy' && 'deployed'}
                          {item.type === 'commit' && 'committed to'}
                          {item.type === 'build' && 'built'}
                          {item.type === 'error' && 'error in'}
                        </span>
                        <span className="font-medium text-[13px]">{item.project}</span>
                      </div>
                      {item.status && (
                        <Badge
                          variant={
                            item.status === 'success' ? 'default' :
                            item.status === 'error' ? 'destructive' : 'secondary'
                          }
                          className="text-[11px]"
                        >
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    {item.message && (
                      <p className="text-[13px] text-muted-foreground">{item.message}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">{item.time}</p>
                  </div>
                </LazyMotionDiv>
              ))}
            </div>
          </LazyAnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

export default ActivityFeed;