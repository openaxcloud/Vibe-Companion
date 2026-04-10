// @ts-nocheck
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, Mail, Key, ArrowLeft } from 'lucide-react';

interface TwoFactorVerifyProps {
  challengeId: string;
  onSuccess: (pendingSessionToken: string) => void;
  onCancel: () => void;
  email?: string;
}

export function TwoFactorVerify({ challengeId, onSuccess, onCancel, email }: TwoFactorVerifyProps) {
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<'totp' | 'backup' | 'emergency'>('totp');
  const [emergencySent, setEmergencySent] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: ({ verifyToken, type }: { verifyToken: string; type: 'totp' | 'backup' | 'emergency' }) => 
      apiRequest('POST', '/api/2fa/challenge/verify', { 
        challengeId, 
        token: verifyToken,
        type
      }),
    onSuccess: (data: { success: boolean; pendingSessionToken: string }) => {
      if (data.success && data.pendingSessionToken) {
        onSuccess(data.pendingSessionToken);
      }
    },
    onError: (error: any) => {
      const remaining = error?.attemptsRemaining;
      if (typeof remaining === 'number') {
        setAttemptsRemaining(remaining);
      }
      
      if (remaining === 0) {
        toast({
          title: 'Trop de tentatives',
          description: 'Veuillez vous reconnecter et réessayer.',
          variant: 'destructive',
        });
        onCancel();
      } else {
        toast({
          title: 'Code invalide',
          description: error?.message || 'Le code entré est incorrect.',
          variant: 'destructive',
        });
      }
      setToken('');
    },
  });

  const emergencyMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', '/api/2fa/challenge/emergency', { challengeId }),
    onSuccess: () => {
      setEmergencySent(true);
      setActiveTab('emergency');
      toast({
        title: 'Code envoyé',
        description: 'Un code de secours a été envoyé à votre adresse email.',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer le code de secours.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length >= 6) {
      verifyMutation.mutate({ verifyToken: token, type: activeTab });
    }
  };

  const handleTokenChange = (value: string) => {
    const cleaned = activeTab === 'backup' 
      ? value.toUpperCase().replace(/[^A-Z0-9]/g, '')
      : value.replace(/\D/g, '');
    setToken(cleaned);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle>Vérification en deux étapes</CardTitle>
        <CardDescription>
          {email ? `Connecté en tant que ${email}` : 'Entrez votre code de vérification'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="totp" className="text-[11px] sm:text-[13px]" data-testid="tab-totp">
              <Key className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">App</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="text-[11px] sm:text-[13px]" data-testid="tab-backup">
              <Shield className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Secours</span>
            </TabsTrigger>
            <TabsTrigger value="emergency" className="text-[11px] sm:text-[13px]" data-testid="tab-emergency">
              <Mail className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="totp">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp-token">Code de l'application</Label>
                <Input
                  id="totp-token"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={token}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                  autoComplete="one-time-code"
                  data-testid="input-totp-token"
                />
                <p className="text-[11px] text-muted-foreground text-center">
                  Ouvrez votre application d'authentification et entrez le code à 6 chiffres
                </p>
              </div>
              
              {attemptsRemaining < 3 && (
                <p className="text-[13px] text-center text-yellow-600 dark:text-yellow-400">
                  {attemptsRemaining} tentative{attemptsRemaining > 1 ? 's' : ''} restante{attemptsRemaining > 1 ? 's' : ''}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={token.length !== 6 || verifyMutation.isPending}
                data-testid="btn-verify-totp"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Vérifier
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="backup">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup-token">Code de secours</Label>
                <Input
                  id="backup-token"
                  type="text"
                  maxLength={8}
                  placeholder="XXXXXXXX"
                  value={token}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  className="text-center text-xl tracking-widest font-mono uppercase"
                  autoFocus
                  data-testid="input-backup-token"
                />
                <p className="text-[11px] text-muted-foreground text-center">
                  Utilisez l'un de vos codes de secours à 8 caractères
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={token.length !== 8 || verifyMutation.isPending}
                data-testid="btn-verify-backup"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Vérifier
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="emergency">
            <div className="space-y-4">
              {!emergencySent ? (
                <>
                  <p className="text-[13px] text-muted-foreground text-center">
                    Vous n'avez pas accès à votre application d'authentification ni à vos codes de secours ?
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => emergencyMutation.mutate()}
                    disabled={emergencyMutation.isPending}
                    data-testid="btn-request-emergency"
                  >
                    {emergencyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Envoyer un code par email
                  </Button>
                </>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency-token">Code reçu par email</Label>
                    <Input
                      id="emergency-token"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={token}
                      onChange={(e) => handleTokenChange(e.target.value)}
                      className="text-center text-2xl tracking-widest font-mono"
                      autoFocus
                      data-testid="input-emergency-token"
                    />
                    <p className="text-[11px] text-muted-foreground text-center">
                      Vérifiez votre boîte de réception
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={token.length !== 6 || verifyMutation.isPending}
                    data-testid="btn-verify-emergency"
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Vérifier
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-[13px]"
                    onClick={() => emergencyMutation.mutate()}
                    disabled={emergencyMutation.isPending}
                  >
                    Renvoyer le code
                  </Button>
                </form>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onCancel}
            data-testid="btn-cancel-2fa"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la connexion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
