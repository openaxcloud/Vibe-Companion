import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  Users, Gift, Copy, Share2, Mail, 
  Twitter, Facebook, Link2, TrendingUp,
  DollarSign, Check, ChevronRight, Star,
  Trophy, Zap, Crown, MessageSquare
} from 'lucide-react';

export default function Referrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [referralCode] = useState(`REF-${user?.username?.toUpperCase()}-2024`);
  const [customMessage, setCustomMessage] = useState('');
  
  const referralStats = {
    totalReferrals: 12,
    successfulSignups: 8,
    pendingRewards: 3,
    totalEarned: 4000,
    currentTier: 'Silver',
    nextTier: 'Gold',
    progressToNextTier: 65
  };

  const referralHistory = [
    {
      id: 1,
      username: 'alice_dev',
      status: 'completed',
      date: '2024-01-28',
      reward: 500,
      avatar: '👩‍💻'
    },
    {
      id: 2,
      username: 'bob_coder',
      status: 'completed',
      date: '2024-01-25',
      reward: 500,
      avatar: '👨‍💻'
    },
    {
      id: 3,
      username: 'charlie_hacker',
      status: 'pending',
      date: '2024-01-30',
      reward: 500,
      avatar: '🧑‍💻'
    },
    {
      id: 4,
      username: 'diana_engineer',
      status: 'expired',
      date: '2024-01-15',
      reward: 0,
      avatar: '👩‍🔧'
    }
  ];

  const tiers = [
    {
      name: 'Bronze',
      referrals: 0,
      reward: 500,
      perks: ['500 Cycles per referral', 'Basic referral tracking']
    },
    {
      name: 'Silver',
      referrals: 5,
      reward: 750,
      perks: ['750 Cycles per referral', 'Priority support', 'Monthly bonus'],
      current: true
    },
    {
      name: 'Gold',
      referrals: 15,
      reward: 1000,
      perks: ['1000 Cycles per referral', 'VIP support', 'Exclusive features']
    },
    {
      name: 'Platinum',
      referrals: 30,
      reward: 1500,
      perks: ['1500 Cycles per referral', 'Personal account manager', 'Early access']
    }
  ];

  const shareOptions = [
    { name: 'Copy Link', icon: <Copy />, action: 'copy' },
    { name: 'Email', icon: <Mail />, action: 'email' },
    { name: 'Twitter', icon: <Twitter />, action: 'twitter' },
    { name: 'Facebook', icon: <Facebook />, action: 'facebook' }
  ];

  const handleShare = (action: string) => {
    const referralUrl = `https://replit.com/signup?ref=${referralCode}`;
    
    switch (action) {
      case 'copy':
        navigator.clipboard.writeText(referralUrl);
        toast({
          title: "Link copied!",
          description: "Your referral link has been copied to clipboard"
        });
        break;
      case 'email':
        window.open(`mailto:?subject=Join me on E-Code&body=${customMessage || 'Check out E-Code!'} ${referralUrl}`);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(customMessage || 'Join me on E-Code!')} ${referralUrl}`);
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${referralUrl}`);
        break;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'expired': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Refer a Friend
        </h1>
        <p className="text-muted-foreground mt-2">
          Invite friends to E-Code and earn rewards together
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold">{referralStats.totalReferrals}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold">{referralStats.successfulSignups}</p>
              </div>
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cycles Earned</p>
                <p className="text-2xl font-bold">{referralStats.totalEarned.toLocaleString()}</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Tier</p>
                <p className="text-2xl font-bold">{referralStats.currentTier}</p>
              </div>
              <Crown className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="share" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="share">Share & Earn</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        {/* Share Tab */}
        <TabsContent value="share" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Referral Link</CardTitle>
              <CardDescription>
                Share your unique link to start earning rewards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Your referral code</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-lg font-mono bg-background px-3 py-2 rounded border">
                    {referralCode}
                  </code>
                  <Button 
                    variant="outline"
                    onClick={() => handleShare('copy')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="message" className="mb-2">Custom Message (optional)</Label>
                <textarea
                  id="message"
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border bg-background"
                  placeholder="Add a personal message to your referral..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {shareOptions.map((option) => (
                  <Button
                    key={option.action}
                    variant="outline"
                    onClick={() => handleShare(option.action)}
                    className="flex items-center gap-2"
                  >
                    {option.icon}
                    <span>{option.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold">Share your link</h4>
                    <p className="text-sm text-muted-foreground">
                      Send your referral link to friends who might enjoy E-Code
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold">They sign up</h4>
                    <p className="text-sm text-muted-foreground">
                      Your friend creates an account using your referral link
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold">Both earn rewards</h4>
                    <p className="text-sm text-muted-foreground">
                      You both receive Cycles when they complete their first project
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Referral History</CardTitle>
              <CardDescription>
                Track your referrals and rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {referralHistory.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{referral.avatar}</span>
                      <div>
                        <p className="font-medium">{referral.username}</p>
                        <p className="text-sm text-muted-foreground">
                          Joined {referral.date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${getStatusColor(referral.status)}`}>
                        {referral.status === 'completed' && `+${referral.reward} Cycles`}
                        {referral.status === 'pending' && 'Pending'}
                        {referral.status === 'expired' && 'Expired'}
                      </p>
                      <Badge variant={
                        referral.status === 'completed' ? 'default' :
                        referral.status === 'pending' ? 'secondary' : 'outline'
                      }>
                        {referral.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Referral Tiers</CardTitle>
              <CardDescription>
                Unlock better rewards as you refer more friends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress to {referralStats.nextTier}</span>
                  <span>{referralStats.progressToNextTier}%</span>
                </div>
                <Progress value={referralStats.progressToNextTier} className="h-3" />
              </div>

              <div className="space-y-4">
                {tiers.map((tier) => (
                  <Card key={tier.name} className={tier.current ? 'border-primary' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            {tier.name}
                            {tier.current && (
                              <Badge>Current</Badge>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {tier.referrals}+ successful referrals
                          </p>
                          <ul className="space-y-1">
                            {tier.perks.map((perk, index) => (
                              <li key={index} className="text-sm flex items-center gap-2">
                                <Check className="h-3 w-3 text-green-500" />
                                {perk}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {tier.reward}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Cycles/referral
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Referrers</CardTitle>
              <CardDescription>
                See how you rank among other E-Code ambassadors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { rank: 1, name: 'CodeMaster', referrals: 156, reward: 156000, avatar: '🏆' },
                  { rank: 2, name: 'DevGuru', referrals: 132, reward: 132000, avatar: '🥈' },
                  { rank: 3, name: 'TechNinja', referrals: 98, reward: 98000, avatar: '🥉' },
                  { rank: 4, name: 'HackerPro', referrals: 87, reward: 87000, avatar: '👨‍💻' },
                  { rank: 5, name: 'CodingQueen', referrals: 76, reward: 76000, avatar: '👩‍💻' },
                  { rank: 24, name: 'You', referrals: 12, reward: 4000, avatar: '😊', isUser: true }
                ].map((user) => (
                  <div 
                    key={user.rank} 
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      user.isUser ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg w-8">#{user.rank}</span>
                      <span className="text-2xl">{user.avatar}</span>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.referrals} referrals
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{user.reward.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Cycles earned</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6 text-center">
              <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Become a Top Referrer!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Top referrers get exclusive perks, early access to features, and special recognition
              </p>
              <Button>
                Learn More
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}