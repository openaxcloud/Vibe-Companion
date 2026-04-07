import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Zap, 
  Cpu, 
  HardDrive, 
  Activity,
  Gauge,
  Timer,
  Shield,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PowerUp {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  type: 'performance' | 'capacity' | 'feature' | 'time';
  currentValue: number;
  maxValue: number;
  unit: string;
  price: number;
  active: boolean;
  autoRenew: boolean;
  expiresAt?: Date;
}

interface PowerUpUsage {
  powerUpId: string;
  used: number;
  remaining: number;
  percentage: number;
  resetAt: Date;
}

interface PowerUpBundle {
  id: string;
  name: string;
  description: string;
  powerUps: string[];
  discount: number;
  price: number;
  popular?: boolean;
}

interface PowerUpsProps {
  projectId: number;
}

export function PowerUps({ projectId }: PowerUpsProps) {
  const queryClient = useQueryClient();
  const [selectedPowerUp, setSelectedPowerUp] = useState<PowerUp | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // Fetch power-ups
  const { data: powerUps = [] } = useQuery<PowerUp[]>({
    queryKey: ['/api/powerups', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/powerups/${projectId}`);
      return res.json();
    }
  });

  // Fetch usage
  const { data: usage = [] } = useQuery<PowerUpUsage[]>({
    queryKey: ['/api/powerups', projectId, 'usage'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/powerups/${projectId}/usage`);
      return res.json();
    }
  });

  // Fetch bundles
  const { data: bundles = [] } = useQuery<PowerUpBundle[]>({
    queryKey: ['/api/powerups/bundles'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/powerups/bundles');
      return res.json();
    }
  });

  // Activate power-up
  const activatePowerUpMutation = useMutation({
    mutationFn: async (powerUpId: string) => {
      const res = await apiRequest('POST', `/api/powerups/${projectId}/${powerUpId}/activate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/powerups', projectId] });
      toast({
        title: "Power-up activated",
        description: "Your project has been upgraded"
      });
    }
  });

  // Update power-up
  const updatePowerUpMutation = useMutation({
    mutationFn: async ({ powerUpId, value }: { powerUpId: string; value: number }) => {
      const res = await apiRequest('PATCH', `/api/powerups/${projectId}/${powerUpId}`, { value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/powerups', projectId] });
    }
  });

  const getPowerUpTypeColor = (type: PowerUp['type']) => {
    switch (type) {
      case 'performance': return 'text-orange-600';
      case 'capacity': return 'text-blue-600';
      case 'feature': return 'text-purple-600';
      case 'time': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const calculateMonthlyCost = () => {
    return powerUps
      .filter(p => p.active)
      .reduce((sum, p) => sum + (p.price * p.currentValue * 720), 0); // 720 hours/month
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Power Ups</h2>
          <p className="text-muted-foreground">
            Boost your project with additional resources and features
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-muted-foreground">Monthly Cost</p>
          <p className="text-2xl font-bold">${calculateMonthlyCost().toFixed(2)}</p>
        </div>
      </div>

      {/* Active Power-ups Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Active Power-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {powerUps.filter(p => p.active).map(powerUp => {
              const usageData = usage.find(u => u.powerUpId === powerUp.id);
              return (
                <div key={powerUp.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded", getPowerUpTypeColor(powerUp.type))}>
                      {powerUp.icon}
                    </div>
                    <div>
                      <p className="font-medium text-[13px]">{powerUp.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {powerUp.currentValue} {powerUp.unit}
                      </p>
                    </div>
                  </div>
                  {usageData && (
                    <Progress 
                      value={usageData.percentage} 
                      className="h-1.5"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Power-up Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {powerUps.map(powerUp => (
          <Card 
            key={powerUp.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-lg",
              powerUp.active && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedPowerUp(powerUp)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-2 rounded-full bg-background", getPowerUpTypeColor(powerUp.type))}>
                    {powerUp.icon}
                  </div>
                  <div>
                    <CardTitle className="text-[15px]">{powerUp.name}</CardTitle>
                    <CardDescription className="text-[11px]">
                      {powerUp.description}
                    </CardDescription>
                  </div>
                </div>
                {powerUp.active ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="outline">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {powerUp.type === 'performance' || powerUp.type === 'capacity' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span>Current</span>
                    <span className="font-medium">
                      {powerUp.currentValue} / {powerUp.maxValue} {powerUp.unit}
                    </span>
                  </div>
                  <Slider
                    value={[powerUp.currentValue]}
                    max={powerUp.maxValue}
                    step={1}
                    disabled={!powerUp.active}
                    onValueChange={(value) => {
                      if (powerUp.active) {
                        updatePowerUpMutation.mutate({
                          powerUpId: powerUp.id,
                          value: value[0]
                        });
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[13px]">Status</span>
                  <Switch 
                    checked={powerUp.active}
                    onCheckedChange={() => {
                      if (!powerUp.active) {
                        activatePowerUpMutation.mutate(powerUp.id);
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-[13px] text-muted-foreground">Cost</span>
                <span className="font-medium">
                  ${(powerUp.price * (powerUp.currentValue || 1)).toFixed(2)}/hour
                </span>
              </div>

              {powerUp.autoRenew && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle className="h-3 w-3" />
                  Auto-renew enabled
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Power-up Bundles */}
      <Card>
        <CardHeader>
          <CardTitle>Power-up Bundles</CardTitle>
          <CardDescription>
            Save with pre-configured bundles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bundles.map(bundle => (
              <Card 
                key={bundle.id}
                className={cn(
                  "relative overflow-hidden",
                  bundle.popular && "ring-2 ring-primary"
                )}
              >
                {bundle.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-2 py-1 text-[11px] rounded-bl">
                    Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-[15px]">{bundle.name}</CardTitle>
                  <CardDescription className="text-[13px]">
                    {bundle.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {bundle.powerUps.map(powerUpId => {
                      const powerUp = powerUps.find(p => p.id === powerUpId);
                      if (!powerUp) return null;
                      return (
                        <div key={powerUpId} className="flex items-center gap-2 text-[13px]">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span>{powerUp.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] text-muted-foreground">Monthly</span>
                      <div className="text-right">
                        <p className="text-2xl font-bold">${bundle.price}</p>
                        <p className="text-[11px] text-green-600">
                          Save {bundle.discount}%
                        </p>
                      </div>
                    </div>
                    <Button className="w-full" size="sm">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Activate Bundle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Usage & Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usage.map(u => {
              const powerUp = powerUps.find(p => p.id === u.powerUpId);
              if (!powerUp) return null;

              return (
                <div key={u.powerUpId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {powerUp.icon}
                      <span className="font-medium">{powerUp.name}</span>
                    </div>
                    <span className="text-[13px] text-muted-foreground">
                      {u.used} / {u.used + u.remaining} used
                    </span>
                  </div>
                  <Progress value={u.percentage} />
                  <p className="text-[11px] text-muted-foreground">
                    Resets {new Date(u.resetAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}