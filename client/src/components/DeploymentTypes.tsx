import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Globe, Server, Zap, Clock, Cloud, Shield, Settings,
  CheckCircle, AlertCircle, Monitor, Cpu, MemoryStick,
  HardDrive, Timer, Users, MapPin, Key, Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeploymentTypesProps {
  projectId: number;
  onDeploy: (config: DeploymentConfig) => void;
}

interface DeploymentConfig {
  projectId: number;
  type: 'static' | 'autoscale' | 'reserved-vm' | 'scheduled' | 'serverless';
  domain?: string;
  customDomain?: string;
  sslEnabled: boolean;
  environment: 'development' | 'staging' | 'production';
  regions: string[];
  scaling?: {
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
  };
  scheduling?: {
    enabled: boolean;
    cron: string;
    timezone: string;
  };
  resources?: {
    cpu: string;
    memory: string;
    disk: string;
  };
  buildCommand?: string;
  startCommand?: string;
  environmentVars: Record<string, string>;
  healthCheck?: {
    path: string;
    port: number;
    intervalSeconds: number;
    timeoutSeconds: number;
  };
}

const deploymentTypes = [
  {
    id: 'static',
    name: 'Static Hosting',
    description: 'Perfect for static websites, SPAs, and frontend applications',
    icon: <Globe className="h-6 w-6" />,
    features: ['CDN Distribution', 'Instant SSL', 'Custom Domains', 'Global Edge Network'],
    pricing: 'Free tier available',
    recommended: 'React, Vue, HTML/CSS/JS'
  },
  {
    id: 'autoscale',
    name: 'Autoscale',
    description: 'Automatically scales based on traffic with zero configuration',
    icon: <Zap className="h-6 w-6" />,
    features: ['Auto Scaling', 'Load Balancing', 'Health Monitoring', 'Zero Downtime'],
    pricing: 'Pay per use',
    recommended: 'Node.js, Python, APIs'
  },
  {
    id: 'reserved-vm',
    name: 'Reserved VM',
    description: 'Dedicated virtual machine with guaranteed resources',
    icon: <Server className="h-6 w-6" />,
    features: ['Dedicated Resources', 'Full Root Access', 'Custom Configuration', 'SLA Guarantee'],
    pricing: 'Fixed monthly cost',
    recommended: 'Complex apps, databases'
  },
  {
    id: 'serverless',
    name: 'Serverless Functions',
    description: 'Event-driven functions that scale automatically',
    icon: <Cloud className="h-6 w-6" />,
    features: ['Zero Cold Start', 'Event Triggers', 'Auto Scaling', 'Pay per Execution'],
    pricing: 'Pay per execution',
    recommended: 'APIs, microservices'
  },
  {
    id: 'scheduled',
    name: 'Scheduled Jobs',
    description: 'Run tasks on a schedule with cron-like functionality',
    icon: <Clock className="h-6 w-6" />,
    features: ['Cron Scheduling', 'Timezone Support', 'Retry Logic', 'Monitoring'],
    pricing: 'Pay per execution',
    recommended: 'Background tasks, cleanup'
  }
];

const regions = [
  { id: 'us-east-1', name: 'US East (Virginia)', flag: '🇺🇸' },
  { id: 'us-west-2', name: 'US West (Oregon)', flag: '🇺🇸' },
  { id: 'eu-west-1', name: 'Europe (Ireland)', flag: '🇪🇺' },
  { id: 'eu-central-1', name: 'Europe (Frankfurt)', flag: '🇩🇪' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', flag: '🇯🇵' }
];

export function DeploymentTypes({ projectId, onDeploy }: DeploymentTypesProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>('static');
  const [config, setConfig] = useState<Partial<DeploymentConfig>>({
    projectId,
    type: 'static',
    sslEnabled: true,
    environment: 'production',
    regions: ['us-east-1'],
    environmentVars: {}
  });

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setConfig(prev => ({ 
      ...prev, 
      type: type as DeploymentConfig['type'],
      // Reset type-specific configs
      scaling: type === 'autoscale' ? { minInstances: 1, maxInstances: 10, targetCPU: 70, targetMemory: 80 } : undefined,
      scheduling: type === 'scheduled' ? { enabled: true, cron: '0 0 * * *', timezone: 'UTC' } : undefined,
      resources: type === 'reserved-vm' ? { cpu: '2 vCPU', memory: '4 GB', disk: '20 GB' } : undefined
    }));
  };

  const handleDeploy = () => {
    if (!config.type) {
      toast({
        title: "Configuration Required",
        description: "Please select a deployment type and configure settings",
        variant: "destructive"
      });
      return;
    }

    // Validate required fields based on type
    const requiredValidation = validateConfiguration(config as DeploymentConfig);
    if (!requiredValidation.valid) {
      toast({
        title: "Configuration Error",
        description: requiredValidation.message,
        variant: "destructive"
      });
      return;
    }

    onDeploy(config as DeploymentConfig);
    toast({
      title: "Deployment Started",
      description: `Starting ${config.type} deployment...`
    });
  };

  const validateConfiguration = (config: DeploymentConfig): { valid: boolean; message?: string } => {
    if (!config.regions.length) {
      return { valid: false, message: "Please select at least one region" };
    }

    if (config.type === 'scheduled' && !config.scheduling?.cron) {
      return { valid: false, message: "Please configure schedule for scheduled deployment" };
    }

    return { valid: true };
  };

  return (
    <div className="space-y-6">
      {/* Deployment Type Selection */}
      <div>
        <h3 className="text-[15px] font-semibold mb-4">Choose Deployment Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deploymentTypes.map((type) => (
            <Card 
              key={type.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedType === type.id ? 'ring-2 ring-primary border-primary' : ''
              }`}
              onClick={() => handleTypeSelect(type.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {type.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{type.name}</CardTitle>
                    <Badge variant="secondary" className="text-[11px]">
                      {type.pricing}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-[13px]">
                  {type.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {type.features.map((feature, i) => (
                        <Badge key={i} variant="outline" className="text-[11px]">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Best for:</p>
                    <p className="text-[11px] text-foreground">{type.recommended}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Configuration */}
      {selectedType && (
        <div>
          <h3 className="text-[15px] font-semibold mb-4">Deployment Configuration</h3>
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="domains">Domains & SSL</TabsTrigger>
              <TabsTrigger value="scaling">Scaling</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Basic Configuration */}
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Basic Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="environment">Environment</Label>
                      <Select 
                        value={config.environment} 
                        onValueChange={(value) => setConfig(prev => ({ ...prev, environment: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="buildCommand">Build Command</Label>
                      <Input
                        id="buildCommand"
                        placeholder="npm run build"
                        value={config.buildCommand || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, buildCommand: e.target.value }))}
                      />
                    </div>
                  </div>

                  {config.type !== 'static' && config.type !== 'scheduled' && (
                    <div className="space-y-2">
                      <Label htmlFor="startCommand">Start Command</Label>
                      <Input
                        id="startCommand"
                        placeholder="npm start"
                        value={config.startCommand || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, startCommand: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Deployment Regions</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {regions.map((region) => (
                        <div key={region.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={region.id}
                            checked={config.regions?.includes(region.id)}
                            onChange={(e) => {
                              const regions = config.regions || [];
                              if (e.target.checked) {
                                setConfig(prev => ({ ...prev, regions: [...regions, region.id] }));
                              } else {
                                setConfig(prev => ({ ...prev, regions: regions.filter(r => r !== region.id) }));
                              }
                            }}
                            className="rounded border border-input"
                          />
                          <label htmlFor={region.id} className="text-[13px] flex items-center gap-2">
                            <span>{region.flag}</span>
                            {region.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Domains & SSL */}
            <TabsContent value="domains" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Domain & SSL Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ssl"
                      checked={config.sslEnabled}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sslEnabled: checked }))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="ssl" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Enable SSL Certificate
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Free Let's Encrypt SSL certificate with automatic renewal
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
                    <Input
                      id="customDomain"
                      placeholder="your-app.com"
                      value={config.customDomain || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, customDomain: e.target.value }))}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      You'll need to configure DNS records to point to your deployment
                    </p>
                  </div>

                  {!config.customDomain && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-[13px] font-medium">Default E-Code Domain</span>
                      </div>
                      <p className="text-[13px] text-muted-foreground">
                        Your app will be available at: <code>project-{projectId}.e-code.ai</code>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scaling Configuration */}
            <TabsContent value="scaling" className="space-y-4">
              {config.type === 'autoscale' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Auto Scaling Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Min Instances</Label>
                        <Input
                          type="number"
                          min="1"
                          value={config.scaling?.minInstances || 1}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            scaling: { ...prev.scaling!, minInstances: parseInt(e.target.value) }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Instances</Label>
                        <Input
                          type="number"
                          min="1"
                          value={config.scaling?.maxInstances || 10}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            scaling: { ...prev.scaling!, maxInstances: parseInt(e.target.value) }
                          }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Target CPU (%)</Label>
                        <Input
                          type="number"
                          min="10"
                          max="90"
                          value={config.scaling?.targetCPU || 70}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            scaling: { ...prev.scaling!, targetCPU: parseInt(e.target.value) }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Target Memory (%)</Label>
                        <Input
                          type="number"
                          min="10"
                          max="90"
                          value={config.scaling?.targetMemory || 80}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            scaling: { ...prev.scaling!, targetMemory: parseInt(e.target.value) }
                          }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {config.type === 'reserved-vm' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      VM Resource Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Cpu className="h-4 w-4" />
                          CPU
                        </Label>
                        <Select 
                          value={config.resources?.cpu} 
                          onValueChange={(value) => setConfig(prev => ({ 
                            ...prev, 
                            resources: { ...prev.resources!, cpu: value } 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1 vCPU">1 vCPU</SelectItem>
                            <SelectItem value="2 vCPU">2 vCPU</SelectItem>
                            <SelectItem value="4 vCPU">4 vCPU</SelectItem>
                            <SelectItem value="8 vCPU">8 vCPU</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <MemoryStick className="h-4 w-4" />
                          Memory
                        </Label>
                        <Select 
                          value={config.resources?.memory} 
                          onValueChange={(value) => setConfig(prev => ({ 
                            ...prev, 
                            resources: { ...prev.resources!, memory: value } 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2 GB">2 GB</SelectItem>
                            <SelectItem value="4 GB">4 GB</SelectItem>
                            <SelectItem value="8 GB">8 GB</SelectItem>
                            <SelectItem value="16 GB">16 GB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4" />
                          Storage
                        </Label>
                        <Select 
                          value={config.resources?.disk} 
                          onValueChange={(value) => setConfig(prev => ({ 
                            ...prev, 
                            resources: { ...prev.resources!, disk: value } 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="20 GB">20 GB SSD</SelectItem>
                            <SelectItem value="50 GB">50 GB SSD</SelectItem>
                            <SelectItem value="100 GB">100 GB SSD</SelectItem>
                            <SelectItem value="200 GB">200 GB SSD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {config.type === 'scheduled' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      Schedule Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cron Expression</Label>
                        <Input
                          placeholder="0 0 * * *"
                          value={config.scheduling?.cron || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            scheduling: { ...prev.scheduling!, cron: e.target.value }
                          }))}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Example: "0 0 * * *" runs daily at midnight
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Select 
                          value={config.scheduling?.timezone} 
                          onValueChange={(value) => setConfig(prev => ({
                            ...prev,
                            scheduling: { ...prev.scheduling!, timezone: value }
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="America/New_York">Eastern Time</SelectItem>
                            <SelectItem value="America/Chicago">Central Time</SelectItem>
                            <SelectItem value="America/Denver">Mountain Time</SelectItem>
                            <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                            <SelectItem value="Europe/London">London</SelectItem>
                            <SelectItem value="Europe/Paris">Paris</SelectItem>
                            <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Advanced Configuration */}
            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Health Checks & Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Health Check Path</Label>
                      <Input
                        placeholder="/health"
                        value={config.healthCheck?.path || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          healthCheck: { ...prev.healthCheck!, path: e.target.value, port: 5000, intervalSeconds: 30, timeoutSeconds: 5 }
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Health Check Port</Label>
                      <Input
                        type="number"
                        placeholder="3000"
                        value={config.healthCheck?.port || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          healthCheck: { ...prev.healthCheck!, port: parseInt(e.target.value), path: prev.healthCheck?.path || '/health', intervalSeconds: 30, timeoutSeconds: 5 }
                        }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Check Interval (seconds)</Label>
                      <Input
                        type="number"
                        min="10"
                        value={config.healthCheck?.intervalSeconds || 30}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          healthCheck: { ...prev.healthCheck!, intervalSeconds: parseInt(e.target.value) }
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Timeout (seconds)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={config.healthCheck?.timeoutSeconds || 5}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          healthCheck: { ...prev.healthCheck!, timeoutSeconds: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Environment Variables
                  </CardTitle>
                  <CardDescription>
                    Configure environment variables for your deployment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(config.environmentVars || {}).map(([key, value], index) => (
                      <div key={index} className="grid grid-cols-5 gap-2">
                        <Input
                          placeholder="KEY"
                          value={key}
                          onChange={(e) => {
                            const newVars = { ...config.environmentVars };
                            delete newVars[key];
                            newVars[e.target.value] = value;
                            setConfig(prev => ({ ...prev, environmentVars: newVars }));
                          }}
                          className="col-span-2"
                        />
                        <Input
                          placeholder="value"
                          value={value}
                          onChange={(e) => {
                            setConfig(prev => ({
                              ...prev,
                              environmentVars: { ...prev.environmentVars, [key]: e.target.value }
                            }));
                          }}
                          className="col-span-2"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newVars = { ...config.environmentVars };
                            delete newVars[key];
                            setConfig(prev => ({ ...prev, environmentVars: newVars }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConfig(prev => ({
                          ...prev,
                          environmentVars: { ...prev.environmentVars, '': '' }
                        }));
                      }}
                    >
                      Add Variable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Deploy Button */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => setSelectedType('')}>
          Cancel
        </Button>
        <Button onClick={handleDeploy} disabled={!selectedType}>
          <Monitor className="h-4 w-4 mr-2" />
          Deploy Application
        </Button>
      </div>
    </div>
  );
}