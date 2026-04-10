// @ts-nocheck
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldOff, Copy, Check, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
  lastUsed?: string;
}

interface SetupResponse {
  qrCodeUrl: string;
  backupCodes: string[];
}

export function TwoFactorSetup() {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [confirmToken, setConfirmToken] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [step, setStep] = useState<'qr' | 'confirm' | 'backup'>('qr');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery<TwoFactorStatus>({
    queryKey: ['/api/2fa/status'],
  });

  const setupMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/2fa/setup'),
    onSuccess: (data: SetupResponse) => {
      setSetupData(data);
      setStep('qr');
      setShowSetupDialog(true);
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de démarrer la configuration 2FA.',
        variant: 'destructive',
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (token: string) => apiRequest('POST', '/api/2fa/confirm', { token }),
    onSuccess: () => {
      setStep('backup');
      queryClient.invalidateQueries({ queryKey: ['/api/2fa/status'] });
      toast({
        title: 'Succès',
        description: 'L\'authentification à deux facteurs est maintenant activée.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Code invalide',
        description: error?.message || 'Le code entré est incorrect. Veuillez réessayer.',
        variant: 'destructive',
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => apiRequest('POST', '/api/2fa/disable', { password }),
    onSuccess: () => {
      setShowDisableDialog(false);
      setDisablePassword('');
      queryClient.invalidateQueries({ queryKey: ['/api/2fa/status'] });
      toast({
        title: 'Désactivé',
        description: 'L\'authentification à deux facteurs a été désactivée.',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Mot de passe incorrect ou erreur lors de la désactivation.',
        variant: 'destructive',
      });
    },
  });

  const regenerateCodesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/2fa/backup-codes/regenerate'),
    onSuccess: (data: { backupCodes: string[] }) => {
      setSetupData(prev => prev ? { ...prev, backupCodes: data.backupCodes } : { qrCodeUrl: '', backupCodes: data.backupCodes });
      setShowBackupCodesDialog(true);
      queryClient.invalidateQueries({ queryKey: ['/api/2fa/status'] });
      toast({
        title: 'Codes régénérés',
        description: 'Vos nouveaux codes de secours ont été générés.',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de régénérer les codes de secours.',
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllCodes = async () => {
    if (setupData?.backupCodes) {
      await navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      toast({
        title: 'Copié',
        description: 'Tous les codes ont été copiés dans le presse-papiers.',
      });
    }
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmToken.length === 6) {
      confirmMutation.mutate(confirmToken);
    }
  };

  const handleDisableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disablePassword) {
      disableMutation.mutate(disablePassword);
    }
  };

  const closeSetupDialog = () => {
    setShowSetupDialog(false);
    setSetupData(null);
    setConfirmToken('');
    setStep('qr');
  };

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status?.enabled ? (
                <ShieldCheck className="h-6 w-6 text-green-500" />
              ) : (
                <Shield className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-[15px]">Authentification à deux facteurs</CardTitle>
                <CardDescription>
                  Ajoutez une couche de sécurité supplémentaire à votre compte
                </CardDescription>
              </div>
            </div>
            <Badge variant={status?.enabled ? 'default' : 'secondary'}>
              {status?.enabled ? 'Activé' : 'Désactivé'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.enabled ? (
            <>
              <div className="flex flex-col sm:flex-row gap-4 text-[13px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Codes de secours restants: <strong>{status.backupCodesRemaining}</strong></span>
                </div>
                {status.lastUsed && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <span>Dernière utilisation: {new Date(status.lastUsed).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              
              {status.backupCodesRemaining < 3 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-[13px]">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <span>Il vous reste peu de codes de secours. Pensez à en régénérer.</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => regenerateCodesMutation.mutate()}
                  disabled={regenerateCodesMutation.isPending}
                  className="flex-1"
                  data-testid="btn-regenerate-backup-codes"
                >
                  {regenerateCodesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Régénérer les codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableDialog(true)}
                  className="flex-1"
                  data-testid="btn-disable-2fa"
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Désactiver 2FA
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-muted-foreground">
                Protégez votre compte avec une application d'authentification comme Google Authenticator, 
                Authy ou 1Password. Vous devrez entrer un code à 6 chiffres à chaque connexion.
              </p>
              <Button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="btn-enable-2fa"
              >
                {setupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Activer l'authentification 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === 'qr' && 'Scanner le QR Code'}
              {step === 'confirm' && 'Confirmer la configuration'}
              {step === 'backup' && 'Codes de secours'}
            </DialogTitle>
            <DialogDescription>
              {step === 'qr' && 'Scannez ce code avec votre application d\'authentification'}
              {step === 'confirm' && 'Entrez le code à 6 chiffres de votre application'}
              {step === 'backup' && 'Conservez ces codes en lieu sûr'}
            </DialogDescription>
          </DialogHeader>

          {step === 'qr' && setupData && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={setupData.qrCodeUrl}
                  alt="QR Code 2FA"
                  className="w-48 h-48"
                  data-testid="img-2fa-qrcode"
                />
              </div>
              <p className="text-[13px] text-center text-muted-foreground">
                Impossible de scanner ? Entrez le code manuellement dans votre application.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={closeSetupDialog}>
                  Annuler
                </Button>
                <Button onClick={() => setStep('confirm')} data-testid="btn-next-step">
                  Suivant
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'confirm' && (
            <form onSubmit={handleConfirmSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-token">Code de vérification</Label>
                <Input
                  id="confirm-token"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={confirmToken}
                  onChange={(e) => setConfirmToken(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                  data-testid="input-2fa-confirm-token"
                />
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setStep('qr')}>
                  Retour
                </Button>
                <Button
                  type="submit"
                  disabled={confirmToken.length !== 6 || confirmMutation.isPending}
                  data-testid="btn-confirm-2fa"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Confirmer
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === 'backup' && setupData && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-background rounded font-mono text-[13px]"
                    >
                      <span>{code}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(code)}
                        className="p-1 hover:bg-muted rounded"
                        data-testid={`btn-copy-code-${index}`}
                      >
                        {copiedCode === code ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-[13px]">
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span>Chaque code ne peut être utilisé qu'une seule fois. Conservez-les en lieu sûr.</span>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={copyAllCodes} className="w-full sm:w-auto">
                  <Copy className="h-4 w-4 mr-2" />
                  Copier tout
                </Button>
                <Button onClick={closeSetupDialog} className="w-full sm:w-auto" data-testid="btn-finish-setup">
                  Terminé
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Désactiver l'authentification 2FA</DialogTitle>
            <DialogDescription>
              Entrez votre mot de passe pour confirmer la désactivation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDisableSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Mot de passe</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Votre mot de passe"
                autoFocus
                data-testid="input-disable-password"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDisableDialog(false);
                  setDisablePassword('');
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!disablePassword || disableMutation.isPending}
                data-testid="btn-confirm-disable-2fa"
              >
                {disableMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Désactiver
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showBackupCodesDialog} onOpenChange={setShowBackupCodesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveaux codes de secours</DialogTitle>
            <DialogDescription>
              Vos anciens codes ont été invalidés. Voici vos nouveaux codes.
            </DialogDescription>
          </DialogHeader>
          {setupData && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-background rounded font-mono text-[13px]"
                    >
                      <span>{code}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(code)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        {copiedCode === code ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={copyAllCodes} className="w-full sm:w-auto">
                  <Copy className="h-4 w-4 mr-2" />
                  Copier tout
                </Button>
                <Button onClick={() => setShowBackupCodesDialog(false)} className="w-full sm:w-auto">
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
