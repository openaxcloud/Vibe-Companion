import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Rocket, Shield, Star, Timer, Cpu, Cloud, Database } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function PowerUps() {
  const { toast } = useToast();
  const { data: powerUps, isLoading, error } = useQuery({
    queryKey: ['/api/powerups']
  });

  const { data: userPowerUps } = useQuery({
    queryKey: ['/api/user/powerups']
  });

  // Error state handling
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-destructive text-lg">Failed to load PowerUps</div>
        <p className="text-muted-foreground">{(error as Error).message || 'An unexpected error occurred'}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const handleActivate = async (powerUpId: string) => {
    try {
      await apiRequest('POST', `/api/powerups/${powerUpId}/activate`, {});
      toast({
        title: "PowerUp Activated",
        description: "Your boost is now active and will enhance your development experience!",
      });
    } catch (error: any) {
      toast({
        title: "Activation Failed", 
        description: error.message || "Failed to activate PowerUp",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const availablePowerUps = [
    {
      id: 'ai-boost',
      name: 'AI Boost',
      description: 'Get 2x faster AI code generation and enhanced model access',
      icon: Rocket,
      price: 5,
      duration: '24 hours',
      benefits: ['2x AI speed', 'Priority queue', 'Advanced models'],
      active: userPowerUps?.some((p: any) => p.id === 'ai-boost')
    },
    {
      id: 'compute-power',
      name: 'Compute Power',
      description: 'Double your CPU and memory limits for intensive tasks',
      icon: Cpu,
      price: 10,
      duration: '7 days',
      benefits: ['2x CPU cores', '4x Memory', 'Priority execution'],
      active: userPowerUps?.some((p: any) => p.id === 'compute-power')
    },
    {
      id: 'storage-expansion',
      name: 'Storage Expansion',
      description: 'Get 100GB additional storage for your projects',
      icon: Database,
      price: 3,
      duration: '30 days',
      benefits: ['100GB storage', 'Faster I/O', 'Automatic backups'],
      active: userPowerUps?.some((p: any) => p.id === 'storage-expansion')
    },
    {
      id: 'collaboration-pro',
      name: 'Collaboration Pro',
      description: 'Enhanced collaboration features for team development',
      icon: Shield,
      price: 8,
      duration: '30 days',
      benefits: ['Unlimited collaborators', 'Screen sharing', 'Voice chat'],
      active: userPowerUps?.some((p: any) => p.id === 'collaboration-pro')
    },
    {
      id: 'deployment-boost',
      name: 'Deployment Boost',
      description: 'Priority deployments with enhanced resources',
      icon: Cloud,
      price: 15,
      duration: '30 days',
      benefits: ['0-downtime deploys', 'Auto-scaling', 'CDN included'],
      active: userPowerUps?.some((p: any) => p.id === 'deployment-boost')
    },
    {
      id: 'time-extension',
      name: 'Time Extension',
      description: 'Extend runtime limits for long-running processes',
      icon: Timer,
      price: 5,
      duration: '7 days',
      benefits: ['No timeout limits', '24/7 runtime', 'Background jobs'],
      active: userPowerUps?.some((p: any) => p.id === 'time-extension')
    }
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl" data-testid="page-powerups">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2" data-testid="heading-powerups">
          <Zap className="h-8 w-8 text-yellow-500" />
          PowerUps
        </h1>
        <p className="text-muted-foreground">
          Boost your development with temporary enhancements and special abilities
        </p>
      </div>

      {/* Active PowerUps */}
      {userPowerUps && userPowerUps.length > 0 && (
        <Card className="mb-8 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Active PowerUps
            </CardTitle>
            <CardDescription>
              Your currently active boosts and enhancements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {userPowerUps.map((powerUp: any) => (
                <div key={powerUp.id} className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{powerUp.name}</p>
                      <p className="text-[13px] text-muted-foreground">
                        Expires in {powerUp.remainingTime}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available PowerUps */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availablePowerUps.map((powerUp) => {
          const Icon = powerUp.icon;
          return (
            <Card key={powerUp.id} className={powerUp.active ? 'border-primary opacity-60' : ''} data-testid={`card-powerup-${powerUp.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Icon className="h-8 w-8 text-primary" />
                  {powerUp.active && (
                    <Badge variant="default">Active</Badge>
                  )}
                </div>
                <CardTitle className="mt-4">{powerUp.name}</CardTitle>
                <CardDescription>{powerUp.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[13px] font-medium">Benefits:</p>
                    <ul className="text-[13px] text-muted-foreground space-y-1">
                      {powerUp.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="text-primary">✓</span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-2xl font-bold">${powerUp.price}</p>
                      <p className="text-[11px] text-muted-foreground">{powerUp.duration}</p>
                    </div>
                    <Button 
                      onClick={() => handleActivate(powerUp.id)}
                      disabled={powerUp.active}
                      variant={powerUp.active ? "secondary" : "default"}
                      data-testid={`button-activate-${powerUp.id}`}
                    >
                      {powerUp.active ? 'Already Active' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* PowerUp Tips */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>PowerUp Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px] text-muted-foreground">
          <p>• PowerUps stack - activate multiple for combined benefits</p>
          <p>• Duration starts immediately upon activation</p>
          <p>• PowerUps apply to all your projects while active</p>
          <p>• Get discounts when purchasing multiple PowerUps at once</p>
        </CardContent>
      </Card>
    </div>
  );
}