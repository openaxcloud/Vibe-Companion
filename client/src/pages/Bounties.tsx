import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Target, DollarSign, Clock, Users, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Bounties() {
  const { data: bounties, isLoading } = useQuery({
    queryKey: ['/api/bounties']
  });

  const { data: userBounties } = useQuery({
    queryKey: ['/api/user/bounties']
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeBounties = bounties?.filter((b: any) => b.status === 'active') || [];
  const completedBounties = userBounties?.completed || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl" data-testid="page-bounties">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="heading-bounties">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Bounties
        </h1>
        <p className="text-muted-foreground">
          Complete challenges and earn rewards for your contributions
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card data-testid="stat-total-earned">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-earned">${userBounties?.totalEarned || 0}</div>
            <p className="text-[11px] text-muted-foreground">From bounties</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Completed</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedBounties.length}</div>
            <p className="text-[11px] text-muted-foreground">Bounties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Active</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBounties.length}</div>
            <p className="text-[11px] text-muted-foreground">Available now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">Rank</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{userBounties?.rank || '-'}</div>
            <p className="text-[11px] text-muted-foreground">Global ranking</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Bounties */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Active Bounties</CardTitle>
          <CardDescription>
            Current challenges you can complete for rewards
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeBounties.length > 0 ? (
            <div className="space-y-4">
              {activeBounties.map((bounty: any) => (
                <div key={bounty.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[15px]">{bounty.title}</h3>
                      <p className="text-[13px] text-muted-foreground mt-1">{bounty.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <Badge variant="secondary">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {bounty.reward}
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {bounty.deadline}
                        </Badge>
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          {bounty.participants} participants
                        </Badge>
                        <Badge variant={bounty.difficulty === 'Easy' ? 'secondary' : bounty.difficulty === 'Medium' ? 'default' : 'destructive'}>
                          {bounty.difficulty}
                        </Badge>
                      </div>
                    </div>
                    <Button onClick={() => window.location.href = `/bounties/${bounty.id}`} data-testid={`button-view-bounty-${bounty.id}`}>
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-[15px]">No active bounties available</p>
              <p className="text-[13px] mt-2">Check back later for new challenges</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Bounties */}
      {completedBounties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Completed Bounties</CardTitle>
            <CardDescription>
              Bounties you've successfully completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedBounties.map((bounty: any) => (
                <div key={bounty.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{bounty.title}</p>
                    <p className="text-[13px] text-muted-foreground">
                      Completed on {new Date(bounty.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-green-600">
                    +${bounty.reward}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}