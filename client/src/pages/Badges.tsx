import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Award, Medal, Trophy, Star, Target, Shield, Zap, GitBranch, Code, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Badges() {
  const { data: userBadges, isLoading } = useQuery({
    queryKey: ['/api/user/badges']
  });

  const { data: allBadges } = useQuery({
    queryKey: ['/api/badges']
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const earnedBadges = userBadges?.earned || [];
  const inProgressBadges = userBadges?.inProgress || [];
  const totalBadges = allBadges?.length || 0;
  const earnedCount = earnedBadges.length;

  const getProgress = (badgeId: string): number => {
    if (earnedBadges.some((b: any) => b.id === badgeId)) return 100;
    const inProgress = inProgressBadges.find((b: any) => b.id === badgeId);
    return inProgress?.progress ?? 0;
  };

  const badgeCategories = [
    {
      id: 'achievement',
      name: 'Achievements',
      icon: Trophy,
      badges: [
        {
          id: 'first-project',
          name: 'First Project',
          description: 'Create your first project',
          icon: Star,
          rarity: 'common',
          earned: earnedBadges.some((b: any) => b.id === 'first-project'),
          progress: getProgress('first-project')
        },
        {
          id: 'speed-coder',
          name: 'Speed Coder',
          description: 'Complete 10 projects in a week',
          icon: Zap,
          rarity: 'rare',
          earned: earnedBadges.some((b: any) => b.id === 'speed-coder'),
          progress: getProgress('speed-coder')
        },
        {
          id: 'master-builder',
          name: 'Master Builder',
          description: 'Deploy 100 successful projects',
          icon: Shield,
          rarity: 'legendary',
          earned: earnedBadges.some((b: any) => b.id === 'master-builder'),
          progress: getProgress('master-builder')
        }
      ]
    },
    {
      id: 'collaboration',
      name: 'Collaboration',
      icon: Users,
      badges: [
        {
          id: 'team-player',
          name: 'Team Player',
          description: 'Collaborate on 5 projects',
          icon: Users,
          rarity: 'common',
          earned: earnedBadges.some((b: any) => b.id === 'team-player'),
          progress: getProgress('team-player')
        },
        {
          id: 'mentor',
          name: 'Mentor',
          description: 'Help 20 users with their projects',
          icon: Medal,
          rarity: 'rare',
          earned: earnedBadges.some((b: any) => b.id === 'mentor'),
          progress: getProgress('mentor')
        }
      ]
    },
    {
      id: 'technical',
      name: 'Technical',
      icon: Code,
      badges: [
        {
          id: 'polyglot',
          name: 'Polyglot',
          description: 'Use 5 different programming languages',
          icon: Code,
          rarity: 'rare',
          earned: earnedBadges.some((b: any) => b.id === 'polyglot'),
          progress: getProgress('polyglot')
        },
        {
          id: 'git-master',
          name: 'Git Master',
          description: 'Make 1000 commits',
          icon: GitBranch,
          rarity: 'epic',
          earned: earnedBadges.some((b: any) => b.id === 'git-master'),
          progress: getProgress('git-master')
        },
        {
          id: 'ai-pioneer',
          name: 'AI Pioneer',
          description: 'Generate 100 AI-powered projects',
          icon: Target,
          rarity: 'legendary',
          earned: earnedBadges.some((b: any) => b.id === 'ai-pioneer'),
          progress: getProgress('ai-pioneer')
        }
      ]
    }
  ];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      case 'legendary': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getRarityBadgeVariant = (rarity: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (rarity) {
      case 'legendary': return 'default';
      case 'epic': return 'secondary';
      case 'rare': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl" data-testid="page-badges">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="heading-badges">
          <Award className="h-8 w-8 text-yellow-500" />
          Badges
        </h1>
        <p className="text-muted-foreground">
          Earn badges by completing achievements and milestones
        </p>
      </div>

      {/* Overall Progress */}
      <Card className="mb-8" data-testid="card-progress">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Your Progress</span>
            <Badge variant="default" className="text-[15px] px-3 py-1" data-testid="badge-count">
              {earnedCount}/{totalBadges} Badges
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={(earnedCount / totalBadges) * 100} className="h-3" data-testid="progress-badges" />
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{earnedBadges.filter((b: any) => b.rarity === 'common').length}</p>
              <p className="text-[13px] text-muted-foreground">Common</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{earnedBadges.filter((b: any) => b.rarity === 'rare').length}</p>
              <p className="text-[13px] text-muted-foreground">Rare</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-500">{earnedBadges.filter((b: any) => b.rarity === 'epic').length}</p>
              <p className="text-[13px] text-muted-foreground">Epic</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-500">{earnedBadges.filter((b: any) => b.rarity === 'legendary').length}</p>
              <p className="text-[13px] text-muted-foreground">Legendary</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badge Categories */}
      {badgeCategories.map((category) => {
        const CategoryIcon = category.icon;
        return (
          <Card key={category.id} className="mb-6" data-testid={`card-category-${category.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CategoryIcon className="h-5 w-5" />
                {category.name}
              </CardTitle>
              <CardDescription>
                {category.badges.filter(b => b.earned).length}/{category.badges.length} badges earned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {category.badges.map((badge) => {
                  const BadgeIcon = badge.icon;
                  return (
                    <div 
                      key={badge.id}
                      className={`relative p-4 border rounded-lg transition-all ${
                        badge.earned 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted opacity-75'
                      }`}
                      data-testid={`badge-item-${badge.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-3 rounded-full ${
                          badge.earned 
                            ? getRarityColor(badge.rarity) 
                            : 'bg-gray-300'
                        }`}>
                          <BadgeIcon className="h-6 w-6 text-white" />
                        </div>
                        <Badge variant={getRarityBadgeVariant(badge.rarity)} className="capitalize">
                          {badge.rarity}
                        </Badge>
                      </div>
                      <h3 className="font-semibold mb-1">{badge.name}</h3>
                      <p className="text-[13px] text-muted-foreground mb-3">{badge.description}</p>
                      
                      {!badge.earned && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[13px]">
                            <span>Progress</span>
                            <span className="font-medium">{badge.progress}%</span>
                          </div>
                          <Progress value={badge.progress} className="h-2" />
                        </div>
                      )}
                      
                      {badge.earned && (
                        <div className="flex items-center gap-2 text-[13px] text-green-600">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="font-medium">Earned!</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Showcase Section */}
      <Card>
        <CardHeader>
          <CardTitle>Badge Showcase</CardTitle>
          <CardDescription>
            Your rarest and most impressive badges
          </CardDescription>
        </CardHeader>
        <CardContent>
          {earnedBadges.filter((b: any) => b.rarity === 'legendary' || b.rarity === 'epic').length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {earnedBadges
                .filter((b: any) => b.rarity === 'legendary' || b.rarity === 'epic')
                .map((badge: any) => (
                  <div key={badge.id} className="flex items-center gap-2 p-3 border rounded-lg bg-primary/5">
                    <div className={`p-2 rounded-full ${getRarityColor(badge.rarity)}`}>
                      <Trophy className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{badge.rarity}</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No rare badges earned yet</p>
              <p className="text-[13px] mt-2">Keep completing achievements to earn epic and legendary badges!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}