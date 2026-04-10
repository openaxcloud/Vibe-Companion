// @ts-nocheck
import { DatabaseStorage } from '../storage';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'coding' | 'community' | 'learning' | 'achievement' | 'special';
  criteria: {
    type: 'projects_created' | 'lines_written' | 'days_streak' | 'languages_used' | 
          'deployments' | 'collaborations' | 'bounties_completed' | 'upvotes_received' |
          'comments_helpful' | 'tutorials_completed';
    value: number;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  cyclesReward?: number;
}

export interface UserBadge {
  id: number;
  userId: number;
  badgeId: string;
  earnedAt: Date;
  progress?: number;
  showcased: boolean;
}

export interface Achievement {
  id: number;
  userId: number;
  type: 'milestone' | 'daily' | 'weekly' | 'special';
  title: string;
  description: string;
  cyclesReward: number;
  xpReward: number;
  completedAt: Date;
}

export interface UserStats {
  userId: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalProjects: number;
  totalLinesOfCode: number;
  totalDeployments: number;
  currentStreak: number;
  longestStreak: number;
  languagesUsed: string[];
  totalBadges: number;
  totalAchievements: number;
  rank?: number;
}

export interface Leaderboard {
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
  category: 'xp' | 'projects' | 'deployments' | 'contributions' | 'streak';
  entries: {
    rank: number;
    userId: number;
    username: string;
    avatarUrl?: string;
    value: number;
    change?: number; // Position change from previous period
  }[];
}

export class GamificationService {
  private badges: Badge[] = [
    {
      id: 'first-project',
      name: 'Hello World',
      description: 'Create your first project',
      icon: '🎯',
      category: 'coding',
      criteria: { type: 'projects_created', value: 1 },
      rarity: 'common',
      cyclesReward: 50
    },
    {
      id: 'speed-coder',
      name: 'Speed Coder',
      description: 'Write 1,000 lines of code in a day',
      icon: '⚡',
      category: 'coding',
      criteria: { type: 'lines_written', value: 1000 },
      rarity: 'uncommon',
      cyclesReward: 100
    },
    {
      id: 'polyglot',
      name: 'Polyglot',
      description: 'Use 5 different programming languages',
      icon: '🌍',
      category: 'learning',
      criteria: { type: 'languages_used', value: 5 },
      rarity: 'rare',
      cyclesReward: 200
    },
    {
      id: 'deployment-master',
      name: 'Deployment Master',
      description: 'Deploy 10 projects',
      icon: '🚀',
      category: 'achievement',
      criteria: { type: 'deployments', value: 10 },
      rarity: 'rare',
      cyclesReward: 300
    },
    {
      id: 'streak-warrior',
      name: 'Streak Warrior',
      description: 'Code for 30 days in a row',
      icon: '🔥',
      category: 'achievement',
      criteria: { type: 'days_streak', value: 30 },
      rarity: 'epic',
      cyclesReward: 500
    },
    {
      id: 'community-hero',
      name: 'Community Hero',
      description: 'Receive 100 upvotes on your projects',
      icon: '❤️',
      category: 'community',
      criteria: { type: 'upvotes_received', value: 100 },
      rarity: 'epic',
      cyclesReward: 400
    },
    {
      id: 'bounty-hunter',
      name: 'Bounty Hunter',
      description: 'Complete 5 bounties',
      icon: '💰',
      category: 'achievement',
      criteria: { type: 'bounties_completed', value: 5 },
      rarity: 'legendary',
      cyclesReward: 1000
    }
  ];

  constructor(private storage: DatabaseStorage) {}

  async getUserStats(userId: number): Promise<UserStats> {
    const stats = await this.storage.getUserStats(userId);
    
    // Calculate level from XP
    const level = Math.floor(Math.sqrt(stats.xp / 100)) + 1;
    const xpForCurrentLevel = Math.pow(level - 1, 2) * 100;
    const xpForNextLevel = Math.pow(level, 2) * 100;
    const xpToNextLevel = xpForNextLevel - stats.xp;
    
    return {
      ...stats,
      level,
      xpToNextLevel
    };
  }

  async checkAndAwardBadges(userId: number): Promise<Badge[]> {
    const userStats = await this.getUserStats(userId);
    const userBadges = await this.storage.getUserBadges(userId);
    const earnedBadgeIds = new Set(userBadges.map(b => b.badgeId));
    
    const newBadges: Badge[] = [];
    
    for (const badge of this.badges) {
      if (earnedBadgeIds.has(badge.id)) continue;
      
      let earned = false;
      
      switch (badge.criteria.type) {
        case 'projects_created':
          earned = userStats.totalProjects >= badge.criteria.value;
          break;
        case 'lines_written':
          // Check daily lines written
          const todaysLines = await this.storage.getTodaysLinesWritten(userId);
          earned = todaysLines >= badge.criteria.value;
          break;
        case 'days_streak':
          earned = userStats.currentStreak >= badge.criteria.value;
          break;
        case 'languages_used':
          earned = userStats.languagesUsed.length >= badge.criteria.value;
          break;
        case 'deployments':
          earned = userStats.totalDeployments >= badge.criteria.value;
          break;
        case 'upvotes_received':
          const upvotes = await this.storage.getUserUpvotesReceived(userId);
          earned = upvotes >= badge.criteria.value;
          break;
        case 'bounties_completed':
          const bounties = await this.storage.getUserBountiesCompleted(userId);
          earned = bounties >= badge.criteria.value;
          break;
      }
      
      if (earned) {
        await this.awardBadge(userId, badge);
        newBadges.push(badge);
      }
    }
    
    return newBadges;
  }

  private async awardBadge(userId: number, badge: Badge): Promise<void> {
    await this.storage.createUserBadge({
      userId,
      badgeId: badge.id,
      earnedAt: new Date(),
      showcased: false
    });
    
    // Award cycles if applicable
    if (badge.cyclesReward) {
      await this.storage.addUserCycles(userId, badge.cyclesReward);
    }
    
    // Award XP
    const xpReward = this.calculateBadgeXP(badge.rarity);
    await this.storage.addUserXP(userId, xpReward);
    
    // Create achievement
    await this.storage.createAchievement({
      userId,
      type: 'special',
      title: `Earned ${badge.name} badge!`,
      description: badge.description,
      cyclesReward: badge.cyclesReward || 0,
      xpReward,
      completedAt: new Date()
    });
  }

  private calculateBadgeXP(rarity: Badge['rarity']): number {
    const xpValues = {
      common: 50,
      uncommon: 100,
      rare: 250,
      epic: 500,
      legendary: 1000
    };
    return xpValues[rarity];
  }

  async recordActivity(userId: number, activity: {
    type: 'code_written' | 'project_created' | 'deployment' | 'login';
    value?: number;
  }): Promise<void> {
    // Update stats based on activity
    switch (activity.type) {
      case 'code_written':
        await this.storage.incrementUserLinesOfCode(userId, activity.value || 1);
        await this.storage.addUserXP(userId, Math.floor((activity.value || 1) / 10));
        break;
      case 'project_created':
        await this.storage.incrementUserProjects(userId);
        await this.storage.addUserXP(userId, 100);
        break;
      case 'deployment':
        await this.storage.incrementUserDeployments(userId);
        await this.storage.addUserXP(userId, 200);
        break;
      case 'login':
        await this.updateStreak(userId);
        break;
    }
    
    // Check for new badges
    await this.checkAndAwardBadges(userId);
  }

  private async updateStreak(userId: number): Promise<void> {
    const lastActivity = await this.storage.getUserLastActivity(userId);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (!lastActivity || lastActivity < yesterday) {
      // Streak broken
      await this.storage.resetUserStreak(userId);
    } else {
      // Continue streak
      await this.storage.incrementUserStreak(userId);
    }
    
    await this.storage.updateUserLastActivity(userId, now);
  }

  async getLeaderboard(
    period: Leaderboard['period'],
    category: Leaderboard['category'],
    limit: number = 100
  ): Promise<Leaderboard> {
    const entries = await this.storage.getLeaderboard(period, category, limit);
    
    return {
      period,
      category,
      entries: entries.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }))
    };
  }

  async getUserBadges(userId: number): Promise<(Badge & UserBadge)[]> {
    const userBadges = await this.storage.getUserBadges(userId);
    
    return userBadges.map(userBadge => {
      const badge = this.badges.find(b => b.id === userBadge.badgeId)!;
      return {
        ...badge,
        ...userBadge
      };
    });
  }

  async getUserAchievements(userId: number, limit?: number): Promise<Achievement[]> {
    return this.storage.getUserAchievements(userId, limit);
  }

  async showcaseBadges(userId: number, badgeIds: string[]): Promise<void> {
    // Unshowcase all badges first
    await this.storage.unshowcaseAllBadges(userId);
    
    // Showcase selected badges (max 3)
    const toShowcase = badgeIds.slice(0, 3);
    for (const badgeId of toShowcase) {
      await this.storage.showcaseBadge(userId, badgeId);
    }
  }

  async getUserRank(userId: number): Promise<number> {
    return this.storage.getUserRank(userId);
  }
}