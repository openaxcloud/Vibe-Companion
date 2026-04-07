// @ts-nocheck
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Trophy, 
  Star, 
  Target, 
  Zap,
  Award,
  TrendingUp,
  Users,
  Calendar,
  Flame,
  Gift,
  Crown,
  Medal
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface UserStats {
  level: number;
  experience: number;
  experienceToNextLevel: number;
  streak: number;
  totalPoints: number;
  rank: string;
  percentile: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'coding' | 'collaboration' | 'learning' | 'community' | 'special';
  points: number;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  earnedAt?: Date;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface Leaderboard {
  userId: number;
  username: string;
  level: number;
  points: number;
  streak: number;
  rank: number;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  points: number;
  progress: number;
  target: number;
  expiresAt: Date;
}

interface GamificationProps {
  userId?: number;
}

export function Gamification({ userId }: GamificationProps) {
  const [selectedTab, setSelectedTab] = useState('overview');

  // Fetch user stats
  const { data: userStats } = useQuery<UserStats>({
    queryKey: userId ? [`/api/gamification/stats?userId=${userId}`] : ['/api/gamification/stats']
  });

  // Fetch achievements
  const { data: achievements = [] } = useQuery<Achievement[]>({
    queryKey: userId ? [`/api/gamification/achievements?userId=${userId}`] : ['/api/gamification/achievements']
  });

  // Fetch badges
  const { data: badges = [] } = useQuery<Badge[]>({
    queryKey: userId ? [`/api/gamification/badges?userId=${userId}`] : ['/api/gamification/badges']
  });

  // Fetch leaderboard
  const { data: leaderboard = [] } = useQuery<Leaderboard[]>({
    queryKey: ['/api/gamification/leaderboard']
  });

  // Fetch challenges
  const { data: challenges = [] } = useQuery<Challenge[]>({
    queryKey: ['/api/gamification/challenges']
  });

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'text-gray-600';
      case 'rare': return 'text-blue-600';
      case 'epic': return 'text-purple-600';
      case 'legendary': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getLevelColor = (level: Badge['level']) => {
    switch (level) {
      case 'bronze': return 'bg-orange-700';
      case 'silver': return 'bg-gray-400';
      case 'gold': return 'bg-yellow-500';
      case 'platinum': return 'bg-gray-200';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* User Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{userStats?.level}</span>
              <Badge variant="secondary">{userStats?.rank}</Badge>
            </div>
            <Progress 
              value={(userStats?.experience || 0) / (userStats?.experienceToNextLevel || 1) * 100} 
              className="mt-2"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {userStats?.experience} / {userStats?.experienceToNextLevel} XP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Flame className="h-8 w-8 text-orange-500" />
              <span className="text-3xl font-bold">{userStats?.streak}</span>
              <span className="text-[13px] text-muted-foreground">days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="h-8 w-8 text-yellow-500" />
              <span className="text-3xl font-bold">
                {userStats?.totalPoints.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Global Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">Top {userStats?.percentile}%</p>
                <p className="text-[11px] text-muted-foreground">
                  Better than {100 - (userStats?.percentile || 0)}% of users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements
                  .filter(a => a.unlockedAt)
                  .sort((a, b) => (b.unlockedAt?.getTime() || 0) - (a.unlockedAt?.getTime() || 0))
                  .slice(0, 4)
                  .map(achievement => (
                    <div key={achievement.id} className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-full bg-background",
                        getRarityColor(achievement.rarity)
                      )}>
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{achievement.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          +{achievement.points} points • {achievement.unlockedAt?.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Badges Showcase */}
          <Card>
            <CardHeader>
              <CardTitle>Your Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {badges.map(badge => (
                  <div key={badge.id} className="text-center">
                    <div className={cn(
                      "mx-auto w-16 h-16 rounded-full flex items-center justify-center",
                      getLevelColor(badge.level)
                    )}>
                      {badge.icon}
                    </div>
                    <p className="text-[13px] font-medium mt-2">{badge.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{badge.level}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          {['coding', 'collaboration', 'learning', 'community', 'special'].map(category => {
            const categoryAchievements = achievements.filter(a => a.category === category);
            if (categoryAchievements.length === 0) return null;

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category} Achievements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryAchievements.map(achievement => (
                      <div 
                        key={achievement.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          achievement.unlockedAt ? "bg-background" : "bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-full",
                            achievement.unlockedAt ? getRarityColor(achievement.rarity) : "text-muted-foreground"
                          )}>
                            {achievement.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{achievement.name}</h4>
                            <p className="text-[11px] text-muted-foreground">
                              {achievement.description}
                            </p>
                            <div className="mt-2">
                              {achievement.progress !== undefined && achievement.maxProgress ? (
                                <div className="space-y-1">
                                  <Progress 
                                    value={(achievement.progress / achievement.maxProgress) * 100} 
                                    className="h-2"
                                  />
                                  <p className="text-[11px] text-muted-foreground">
                                    {achievement.progress} / {achievement.maxProgress}
                                  </p>
                                </div>
                              ) : achievement.unlockedAt ? (
                                <Badge variant="secondary" className="text-[11px]">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Unlocked
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px]">
                                  Locked
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[11px]">
                            +{achievement.points}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Leaderboard</CardTitle>
              <CardDescription>Top performers this month</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {leaderboard.map((user, index) => (
                    <Card key={user.userId} className={cn(
                      "p-4",
                      index < 3 && "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                            index === 0 && "bg-yellow-500 text-white",
                            index === 1 && "bg-gray-400 text-white",
                            index === 2 && "bg-orange-700 text-white",
                            index > 2 && "bg-muted"
                          )}>
                            {user.rank}
                          </div>
                          <Avatar>
                            <AvatarFallback>
                              {user.username[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-[13px] text-muted-foreground">
                              Level {user.level}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{user.points.toLocaleString()}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                            <Flame className="h-3 w-3" />
                            {user.streak} day streak
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenges" className="space-y-4">
          {['daily', 'weekly', 'monthly'].map(type => {
            const typeChallenges = challenges.filter(c => c.type === type);
            if (typeChallenges.length === 0) return null;

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="capitalize">{type} Challenges</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {typeChallenges.map(challenge => {
                      const hoursLeft = Math.floor((challenge.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
                      
                      return (
                        <Card key={challenge.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium">{challenge.name}</h4>
                                <p className="text-[13px] text-muted-foreground">
                                  {challenge.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant="secondary">
                                  +{challenge.points} pts
                                </Badge>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {hoursLeft}h left
                                </p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Progress 
                                value={(challenge.progress / challenge.target) * 100} 
                              />
                              <p className="text-[11px] text-muted-foreground">
                                {challenge.progress} / {challenge.target} completed
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}