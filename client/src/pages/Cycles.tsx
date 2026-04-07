import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, Crown, Rocket, Database, Globe, Shield, 
  ChevronRight, Plus, Minus, Gift, TrendingUp,
  Clock, Server, HardDrive, Users, Star, Award
} from 'lucide-react';

export default function Cycles() {
  const { toast } = useToast();
  const [cycles, setCycles] = useState(1500);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState(1000);

  const plans = [
    {
      id: 'cycles-1000',
      name: '1,000 Cycles',
      price: 10,
      cycles: 1000,
      bonus: 0
    },
    {
      id: 'cycles-5000',
      name: '5,000 Cycles',
      price: 45,
      cycles: 5000,
      bonus: 500,
      popular: true
    },
    {
      id: 'cycles-10000',
      name: '10,000 Cycles',
      price: 80,
      cycles: 10000,
      bonus: 2000
    },
    {
      id: 'cycles-25000',
      name: '25,000 Cycles',
      price: 175,
      cycles: 25000,
      bonus: 7500
    }
  ];

  const powerUps = [
    {
      id: 'always-on',
      name: 'Always On',
      description: 'Keep your Repl running 24/7',
      icon: <Server className="h-5 w-5" />,
      cycleCost: 20,
      period: 'per day',
      active: true
    },
    {
      id: 'boost',
      name: 'Boost',
      description: '4x CPU and RAM for your Repl',
      icon: <Rocket className="h-5 w-5" />,
      cycleCost: 4,
      period: 'per day',
      active: false
    },
    {
      id: 'private-repls',
      name: 'Unlimited Private Repls',
      description: 'Create unlimited private projects',
      icon: <Shield className="h-5 w-5" />,
      cycleCost: 100,
      period: 'per month',
      active: false
    },
    {
      id: 'custom-domain',
      name: 'Custom Domain',
      description: 'Use your own domain for deployments',
      icon: <Globe className="h-5 w-5" />,
      cycleCost: 50,
      period: 'per month',
      active: true
    }
  ];

  const usageHistory = [
    { date: 'Today', cycles: -120, description: 'Always On + Boost' },
    { date: 'Yesterday', cycles: -80, description: 'Always On' },
    { date: 'Jan 23', cycles: +5000, description: 'Purchased Cycles' },
    { date: 'Jan 22', cycles: -150, description: 'Deployments' },
    { date: 'Jan 21', cycles: -80, description: 'Always On' }
  ];

  const handlePurchase = (plan: typeof plans[0]) => {
    setSelectedPlan(plan.id);
    toast({
      title: "Redirecting to checkout",
      description: `Purchasing ${plan.cycles.toLocaleString()} cycles for $${plan.price}`
    });
  };

  const handleTogglePowerUp = (powerUpId: string) => {
    const powerUp = powerUps.find(p => p.id === powerUpId);
    if (powerUp) {
      toast({
        title: powerUp.active ? "Power-up disabled" : "Power-up enabled",
        description: powerUp.active 
          ? `${powerUp.name} has been turned off`
          : `${powerUp.name} is now active`
      });
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3 text-[var(--ecode-text)]">
          <Zap className="h-8 w-8 text-yellow-500" />
          Cycles & Power Ups
        </h1>
        <p className="text-[var(--ecode-text-secondary)] mt-2 text-base">
          Supercharge your Repls with Cycles and unlock powerful features
        </p>
      </div>

      {/* Current Balance */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{cycles.toLocaleString()}</span>
                <span className="text-xl text-muted-foreground">Cycles</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ≈ {Math.floor(cycles / 100)} days of Always On
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-2">Daily Usage</p>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                <span className="text-2xl font-semibold">120</span>
                <span className="text-muted-foreground">Cycles/day</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="purchase" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="purchase">Purchase</TabsTrigger>
          <TabsTrigger value="powerups">Power Ups</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="earn">Earn</TabsTrigger>
        </TabsList>

        {/* Purchase Tab */}
        <TabsContent value="purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buy Cycles</CardTitle>
              <CardDescription>
                Purchase Cycles to power up your Repls and keep them running
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {plans.map((plan) => (
                  <Card 
                    key={plan.id} 
                    className={`cursor-pointer transition-all ${
                      plan.popular ? 'border-primary shadow-lg' : ''
                    }`}
                    onClick={() => handlePurchase(plan)}
                  >
                    {plan.popular && (
                      <Badge className="absolute -top-2 -right-2">Most Popular</Badge>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{plan.cycles.toLocaleString()} Cycles</span>
                        <span className="text-2xl">${plan.price}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Base Cycles</span>
                          <span>{plan.cycles.toLocaleString()}</span>
                        </div>
                        {plan.bonus > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Bonus</span>
                            <span className="text-green-600">+{plan.bonus.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="border-t pt-2">
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span>{(plan.cycles + plan.bonus).toLocaleString()} Cycles</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            ${(plan.price / (plan.cycles + plan.bonus) * 100).toFixed(2)} per 100 Cycles
                          </p>
                        </div>
                      </div>
                      <Button className="w-full mt-4">
                        Purchase
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Custom Amount */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Custom Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPurchaseAmount(Math.max(100, purchaseAmount - 100))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 text-center">
                      <p className="text-3xl font-bold">{purchaseAmount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Cycles</p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPurchaseAmount(purchaseAmount + 100)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-2xl font-semibold">${(purchaseAmount * 0.01).toFixed(2)}</p>
                    <Button className="w-full mt-2">
                      Buy {purchaseAmount.toLocaleString()} Cycles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Power Ups Tab */}
        <TabsContent value="powerups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Power Ups</CardTitle>
              <CardDescription>
                Enhance your Repls with powerful features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {powerUps.map((powerUp) => (
                <Card key={powerUp.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {powerUp.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">{powerUp.name}</h3>
                          <p className="text-sm text-muted-foreground">{powerUp.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary">
                              {powerUp.cycleCost} Cycles {powerUp.period}
                            </Badge>
                            {powerUp.active && (
                              <Badge variant="default">Active</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant={powerUp.active ? "destructive" : "default"}
                        size="sm"
                        onClick={() => handleTogglePowerUp(powerUp.id)}
                      >
                        {powerUp.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>
                Track your Cycles usage over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Usage Chart */}
                <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Usage chart visualization</p>
                </div>

                {/* Recent Transactions */}
                <div className="space-y-2">
                  <h3 className="font-semibold mb-3">Recent Transactions</h3>
                  {usageHistory.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${
                          item.cycles > 0 ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {item.cycles > 0 ? (
                            <Plus className="h-3 w-3 text-green-600" />
                          ) : (
                            <Minus className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                      </div>
                      <span className={`font-semibold ${
                        item.cycles > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.cycles > 0 ? '+' : ''}{item.cycles.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earn Tab */}
        <TabsContent value="earn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Earn Free Cycles</CardTitle>
              <CardDescription>
                Complete tasks and earn Cycles without spending money
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3">
                        <Gift className="h-8 w-8 text-primary" />
                        <div>
                          <h3 className="font-semibold">Daily Login Bonus</h3>
                          <p className="text-sm text-muted-foreground">Log in every day to earn Cycles</p>
                          <Progress value={5} max={7} className="h-2 mt-2" />
                          <p className="text-xs text-muted-foreground mt-1">5/7 days</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">+50</p>
                        <p className="text-sm text-muted-foreground">Cycles/day</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3">
                        <Users className="h-8 w-8 text-blue-500" />
                        <div>
                          <h3 className="font-semibold">Refer Friends</h3>
                          <p className="text-sm text-muted-foreground">Get 500 Cycles for each friend who signs up</p>
                          <Button 
                            variant="link" 
                            className="p-0 h-auto mt-1"
                            onClick={() => window.location.href = '/referrals'}
                          >
                            Get your referral link
                          </Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">+500</p>
                        <p className="text-sm text-muted-foreground">per referral</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3">
                        <Star className="h-8 w-8 text-yellow-500" />
                        <div>
                          <h3 className="font-semibold">Complete Challenges</h3>
                          <p className="text-sm text-muted-foreground">Earn Cycles by completing coding challenges</p>
                          <Button variant="link" className="p-0 h-auto mt-1">
                            View challenges
                          </Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">100-1000</p>
                        <p className="text-sm text-muted-foreground">Cycles</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3">
                        <Award className="h-8 w-8 text-purple-500" />
                        <div>
                          <h3 className="font-semibold">Achievements</h3>
                          <p className="text-sm text-muted-foreground">Unlock achievements and earn bonus Cycles</p>
                          <Progress value={12} max={50} className="h-2 mt-2" />
                          <p className="text-xs text-muted-foreground mt-1">12/50 unlocked</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">Varies</p>
                        <p className="text-sm text-muted-foreground">per achievement</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}