import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, CreditCard, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function Cycles() {
  // Fetch user billing data
  const { data: billingData, isLoading } = useQuery({
    queryKey: ['/api/user/billing']
  });

  const { data: usageData } = useQuery({
    queryKey: ['/api/user/usage']
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing Cycles</h1>
        <p className="text-muted-foreground">
          Track your usage and billing across monthly cycles
        </p>
      </div>

      {/* Current Cycle Overview */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Current Cycle</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {billingData?.currentCycle ? 
                new Date(billingData.currentCycle.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
                ' - ' + 
                new Date(billingData.currentCycle.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'N/A'
              }
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {billingData?.currentCycle?.daysRemaining} days remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Current Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{billingData?.plan || 'Free'}</div>
            <Badge variant={billingData?.subscriptionInfo?.status === 'active' ? 'default' : 'secondary'} className="mt-1">
              {billingData?.subscriptionInfo?.status || 'Active'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Usage This Cycle</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-[13px]">
                <span>Compute</span>
                <span className="font-medium">
                  {usageData?.compute?.used || 0}/{usageData?.compute?.limit || 0} {usageData?.compute?.unit}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span>Storage</span>
                <span className="font-medium">
                  {usageData?.storage?.used || 0}/{usageData?.storage?.limit || 0} {usageData?.storage?.unit}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Previous Cycles */}
      <Card>
        <CardHeader>
          <CardTitle>Previous Billing Cycles</CardTitle>
          <CardDescription>
            Your billing history and usage across previous months
          </CardDescription>
        </CardHeader>
        <CardContent>
          {billingData?.previousCycles && billingData.previousCycles.length > 0 ? (
            <div className="space-y-4">
              {billingData.previousCycles.map((cycle: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{cycle.month}</p>
                      <p className="text-[13px] text-muted-foreground">{cycle.period}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{cycle.amount}</p>
                    <p className="text-[13px] text-muted-foreground">{cycle.plan}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No previous billing cycles</p>
              <p className="text-[13px] mt-2">Your billing history will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <Button onClick={() => window.location.href = '/plans'} data-testid="button-upgrade-plan">
          Upgrade Plan
        </Button>
        <Button variant="outline" onClick={() => window.location.href = '/usage'} data-testid="button-view-usage">
          View Detailed Usage
        </Button>
      </div>
    </div>
  );
}