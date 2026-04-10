// @ts-nocheck
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Users,
  Gift,
  DollarSign,
  Link,
  Check,
  Share2,
  Trophy,
  TrendingUp,
  Clock,
  Star,
  Crown,
  Award,
  Target,
  Zap,
  ExternalLink,
  UserPlus,
  CreditCard,
  CheckCircle,
  XCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  availableCredits: number;
  lifetimeCredits: number;
  rank: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  nextTierProgress: number;
  nextTierRequirement: number;
}

interface Referral {
  id: string;
  email: string;
  username?: string;
  status: 'pending' | 'signed_up' | 'converted' | 'expired';
  reward: number;
  invitedAt: string;
  signedUpAt?: string;
  convertedAt?: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  referrals: number;
  earnings: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

interface Reward {
  id: string;
  type: 'referral' | 'milestone' | 'bonus';
  amount: number;
  description: string;
  earnedAt: string;
  status: 'pending' | 'credited' | 'expired';
}

const stats: ReferralStats = {
  totalReferrals: 0,
  successfulReferrals: 0,
  pendingReferrals: 0,
  totalEarnings: 0,
  availableCredits: 0,
  lifetimeCredits: 0,
  rank: 0,
  tier: 'bronze',
  nextTierProgress: 0,
  nextTierRequirement: 10,
};

const referrals: Referral[] = [];

const leaderboard: LeaderboardEntry[] = [];

const rewards: Reward[] = [];

const referralLink = '';

export default function ReferralsPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'text-orange-600 bg-orange-100',
      silver: 'text-muted-foreground bg-muted',
      gold: 'text-yellow-600 bg-yellow-100',
      platinum: 'text-purple-600 bg-purple-100',
      diamond: 'text-blue-600 bg-blue-100',
    };
    return colors[tier] || 'text-muted-foreground bg-muted';
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'diamond': return <Crown className="h-4 w-4" />;
      case 'platinum': return <Award className="h-4 w-4" />;
      case 'gold': return <Trophy className="h-4 w-4" />;
      case 'silver': return <Star className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode }> = {
      pending: { variant: 'secondary', label: 'Pending', icon: <Clock className="h-3 w-3 mr-1" /> },
      signed_up: { variant: 'outline', label: 'Signed Up', icon: <UserPlus className="h-3 w-3 mr-1" /> },
      converted: { variant: 'default', label: 'Converted', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      expired: { variant: 'destructive', label: 'Expired', icon: <XCircle className="h-3 w-3 mr-1" /> },
      credited: { variant: 'default', label: 'Credited', icon: <Check className="h-3 w-3 mr-1" /> },
    };
    const config = variants[status] || { variant: 'outline' as const, label: status, icon: null };
    return <Badge variant={config.variant}>{config.icon}{config.label}</Badge>;
  };

  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";
  const cardClassName = "border border-border bg-card shadow-sm";

  const navItems = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'referrals', label: 'My Referrals', icon: Users },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'terms', label: 'Terms & FAQ', icon: HelpCircle },
  ];

  return (
    <PageShell>
      <div 
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        style={{ fontFamily: 'var(--ecode-font-sans)' }}
        data-testid="page-referrals"
      >
        <PageHeader
          title="Referral Program"
          description="Referral program coming soon! You'll be able to invite friends to E-Code and earn credits for every successful referral."
          icon={Gift}
          actions={(
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                Coming Soon
              </Badge>
            </div>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          <div className="lg:col-span-1">
            <nav 
              className="space-y-1 p-2 rounded-xl border border-border bg-card"
              data-testid="nav-referrals-sidebar"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 min-h-[44px] ${
                      isActive 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab(item.id)}
                    data-testid={`button-nav-${item.id}`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <Card className={`${cardClassName} mt-4`} data-testid="card-your-tier">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium flex items-center gap-2">
                  {getTierIcon(stats.tier)}
                  Your Tier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] font-medium text-foreground">Coming Soon</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Referral tiers will be available soon</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {activeTab === 'overview' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className={cardClassName} data-testid="card-stat-total-referrals">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] text-muted-foreground">Total Referrals</p>
                          <p className="text-2xl font-bold text-foreground">{stats.totalReferrals}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={cardClassName} data-testid="card-stat-successful">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] text-muted-foreground">Successful</p>
                          <p className="text-2xl font-bold text-foreground">{stats.successfulReferrals}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-500/10">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={cardClassName} data-testid="card-stat-earnings">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] text-muted-foreground">Total Earnings</p>
                          <p className="text-2xl font-bold text-foreground">${stats.totalEarnings}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-yellow-500/10">
                          <DollarSign className="h-5 w-5 text-yellow-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={cardClassName} data-testid="card-stat-rank">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] text-muted-foreground">Your Rank</p>
                          <p className="text-2xl font-bold text-foreground">{stats.rank > 0 ? `#${stats.rank}` : '-'}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-500/10">
                          <Trophy className="h-5 w-5 text-purple-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className={cardClassName} data-testid="card-referral-link">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Link className="h-5 w-5" />
                      Your Referral Link
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Referral program coming soon - share your link with friends and earn credits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8" data-testid="referral-link-coming-soon">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium text-foreground mb-2">Referral Program Coming Soon</h4>
                      <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
                        We're working on setting up the referral program. You'll be able to generate your unique referral link and start earning rewards soon!
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-how-it-works">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4" data-testid="step-1">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <Share2 className="h-6 w-6 text-primary" />
                        </div>
                        <h4 className="font-medium text-foreground mb-2">1. Share Your Link</h4>
                        <p className="text-[13px] text-muted-foreground">Share your unique referral link with friends, colleagues, or on social media</p>
                      </div>
                      <div className="text-center p-4" data-testid="step-2">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <UserPlus className="h-6 w-6 text-primary" />
                        </div>
                        <h4 className="font-medium text-foreground mb-2">2. Friend Signs Up</h4>
                        <p className="text-[13px] text-muted-foreground">Your friend creates an account using your referral link</p>
                      </div>
                      <div className="text-center p-4" data-testid="step-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <Gift className="h-6 w-6 text-primary" />
                        </div>
                        <h4 className="font-medium text-foreground mb-2">3. Both Get Rewarded</h4>
                        <p className="text-[13px] text-muted-foreground">You both receive $50 in credits when they subscribe to a paid plan</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'referrals' && (
              <Card className={cardClassName} data-testid="card-referral-history">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Referral History
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Track the status of all your referrals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {referrals.length === 0 ? (
                    <div className="text-center py-12" data-testid="empty-referrals">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium text-foreground mb-2">No referrals yet</h4>
                      <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
                        Share your referral link with friends to start earning rewards. Your referrals will appear here once they sign up.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table data-testid="table-referrals">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email / Username</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Invited</TableHead>
                            <TableHead>Signed Up</TableHead>
                            <TableHead>Reward</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {referrals.map((referral) => (
                            <TableRow key={referral.id} data-testid={`row-referral-${referral.id}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{referral.username || referral.email}</p>
                                  {referral.username && <p className="text-[11px] text-muted-foreground">{referral.email}</p>}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(referral.status)}</TableCell>
                              <TableCell className="text-[13px] text-muted-foreground">
                                {formatDistanceToNow(new Date(referral.invitedAt), { addSuffix: true })}
                              </TableCell>
                              <TableCell className="text-[13px] text-muted-foreground">
                                {referral.signedUpAt 
                                  ? formatDistanceToNow(new Date(referral.signedUpAt), { addSuffix: true })
                                  : '-'
                                }
                              </TableCell>
                              <TableCell>
                                {referral.reward > 0 ? (
                                  <span className="font-medium text-green-600">${referral.reward}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'rewards' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className={cardClassName} data-testid="card-available-credits">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] text-muted-foreground">Available Credits</p>
                          <p className="text-3xl font-bold text-foreground">${stats.availableCredits}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-500/10">
                          <CreditCard className="h-6 w-6 text-green-500" />
                        </div>
                      </div>
                      <Button className="w-full mt-4" data-testid="button-redeem-credits">
                        Redeem Credits
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className={cardClassName} data-testid="card-lifetime-credits">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] text-muted-foreground">Lifetime Earnings</p>
                          <p className="text-3xl font-bold text-foreground">${stats.lifetimeCredits}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/10">
                          <TrendingUp className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-4">
                        Total credits earned since joining the referral program
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className={cardClassName} data-testid="card-reward-history">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Gift className="h-5 w-5" />
                      Reward History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rewards.length === 0 ? (
                      <div className="text-center py-12" data-testid="empty-rewards">
                        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                          <Gift className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h4 className="font-medium text-foreground mb-2">No rewards yet</h4>
                        <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
                          Start referring friends to earn rewards. Your rewards will appear here once your referrals convert.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rewards.map((reward) => (
                          <div 
                            key={reward.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-all"
                            data-testid={`reward-${reward.id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg ${
                                reward.type === 'referral' ? 'bg-primary/10' : 
                                reward.type === 'milestone' ? 'bg-yellow-500/10' : 'bg-green-500/10'
                              }`}>
                                {reward.type === 'referral' && <UserPlus className="h-4 w-4 text-primary" />}
                                {reward.type === 'milestone' && <Trophy className="h-4 w-4 text-yellow-500" />}
                                {reward.type === 'bonus' && <Gift className="h-4 w-4 text-green-500" />}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{reward.description}</p>
                                <p className="text-[13px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(reward.earnedAt), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-[15px] text-foreground">+${reward.amount}</span>
                              {getStatusBadge(reward.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'leaderboard' && (
              <Card className={cardClassName} data-testid="card-leaderboard">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Top Referrers
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    See how you rank against other community members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12" data-testid="empty-leaderboard">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Trophy className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h4 className="font-medium text-foreground mb-2">Leaderboard Coming Soon</h4>
                    <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
                      The referral leaderboard is being set up. Check back soon to see how you rank against other community members.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'terms' && (
              <Card className={cardClassName} data-testid="card-terms-faq">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Terms & FAQ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full" data-testid="accordion-faq">
                    <AccordionItem value="item-1">
                      <AccordionTrigger data-testid="faq-how-earn">How do I earn referral credits?</AccordionTrigger>
                      <AccordionContent>
                        You earn $50 in credits for each friend who signs up using your referral link and subscribes to a paid plan within 30 days. Your friend also receives $50 in credits as a welcome bonus.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger data-testid="faq-when-credited">When are credits credited to my account?</AccordionTrigger>
                      <AccordionContent>
                        Credits are typically credited within 24-48 hours after your referral subscribes to a paid plan. You can track the status of your referrals in the "My Referrals" tab.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger data-testid="faq-use-credits">How can I use my referral credits?</AccordionTrigger>
                      <AccordionContent>
                        Referral credits can be applied towards your subscription, compute resources, or any paid features on E-Code. Credits never expire as long as your account remains active.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4">
                      <AccordionTrigger data-testid="faq-max-referrals">Is there a limit to how many people I can refer?</AccordionTrigger>
                      <AccordionContent>
                        There's no limit! You can refer as many people as you want. In fact, our top referrers have earned thousands of dollars in credits by actively sharing E-Code with their networks.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-5">
                      <AccordionTrigger data-testid="faq-referral-expiry">Do referral links expire?</AccordionTrigger>
                      <AccordionContent>
                        Your referral link never expires. However, each invitation is valid for 30 days from when the recipient receives it. If they don't sign up within 30 days, the invitation will expire and you can resend it.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-6">
                      <AccordionTrigger data-testid="faq-tier-system">How does the tier system work?</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p>Your tier is based on the number of successful referrals:</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li><strong>Bronze:</strong> 0-9 referrals</li>
                            <li><strong>Silver:</strong> 10-24 referrals</li>
                            <li><strong>Gold:</strong> 25-49 referrals</li>
                            <li><strong>Platinum:</strong> 50-99 referrals</li>
                            <li><strong>Diamond:</strong> 100+ referrals</li>
                          </ul>
                          <p className="mt-2">Higher tiers unlock additional bonuses and exclusive perks!</p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <Separator className="my-6" />

                  <div className="space-y-4" data-testid="terms-section">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Terms and Conditions
                    </h4>
                    <div className="text-[13px] text-muted-foreground space-y-2">
                      <p>By participating in the E-Code Referral Program, you agree to the following terms:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Referral credits are non-transferable and cannot be exchanged for cash.</li>
                        <li>Self-referrals are not permitted and will result in disqualification.</li>
                        <li>E-Code reserves the right to modify or terminate the referral program at any time.</li>
                        <li>Fraudulent or abusive activity will result in account suspension and forfeiture of credits.</li>
                        <li>Referral rewards are subject to verification and may take up to 30 days to process.</li>
                      </ol>
                    </div>
                    <Button variant="link" className="p-0 h-auto text-primary" data-testid="link-full-terms">
                      Read Full Terms & Conditions <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
