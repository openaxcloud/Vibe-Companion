import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Network,
  Globe,
  Shield,
  Lock,
  Server,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Settings,
  RefreshCw,
  Check,
  X,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Wifi,
  Key,
  FileKey,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  Layers,
  Link2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FirewallRule {
  id: string;
  name: string;
  priority: number;
  direction: 'ingress' | 'egress';
  action: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  sourceIp: string;
  destinationIp: string;
  port: string;
  enabled: boolean;
  createdAt: string;
}

interface VPCPeering {
  id: string;
  name: string;
  peerVpcId: string;
  peerRegion: string;
  status: 'active' | 'pending' | 'failed';
  cidrBlock: string;
  createdAt: string;
}

interface DNSRecord {
  id: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  value: string;
  ttl: number;
  priority?: number;
  enabled: boolean;
}

interface SSLCertificate {
  id: string;
  domain: string;
  issuer: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'pending';
  autoRenew: boolean;
  type: 'managed' | 'custom';
}

interface ZeroTrustPolicy {
  id: string;
  name: string;
  description: string;
  conditions: {
    ipRanges?: string[];
    countries?: string[];
    deviceTypes?: string[];
    userGroups?: string[];
  };
  action: 'allow' | 'deny' | 'mfa';
  enabled: boolean;
  priority: number;
}

interface PortForward {
  id: string;
  name: string;
  externalPort: number;
  internalPort: number;
  protocol: 'tcp' | 'udp';
  targetIp: string;
  enabled: boolean;
}

interface TrafficStats {
  totalRequests: number;
  requestsPerSecond: number;
  bandwidthIn: number;
  bandwidthOut: number;
  errorRate: number;
  latencyP50: number;
  latencyP99: number;
  topEndpoints: { path: string; requests: number }[];
  topCountries: { country: string; requests: number }[];
}

interface NetworkNode {
  id: string;
  name: string;
  type: 'vpc' | 'subnet' | 'loadbalancer' | 'instance' | 'gateway';
  status: 'healthy' | 'warning' | 'error';
  connections: string[];
}

const firewallRules: FirewallRule[] = [];
const vpcPeerings: VPCPeering[] = [];
const dnsRecords: DNSRecord[] = [];
const sslCertificates: SSLCertificate[] = [];
const zeroTrustPolicies: ZeroTrustPolicy[] = [];
const portForwards: PortForward[] = [];
const trafficStats: TrafficStats | null = null;
const networkNodes: NetworkNode[] = [];

function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  showContactSales = true 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  showContactSales?: boolean;
}) {
  return (
    <div className="p-8 rounded-lg border border-dashed border-border bg-muted/30 text-center" data-testid="empty-state">
      <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-[15px] font-medium text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4 max-w-md mx-auto">{description}</p>
      {showContactSales && (
        <Badge variant="secondary" className="text-[11px]">
          Enterprise Feature - Contact Sales
        </Badge>
      )}
    </div>
  );
}

export default function NetworkingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('topology');
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [showAddDNSDialog, setShowAddDNSDialog] = useState(false);
  const [showAddPolicyDialog, setShowAddPolicyDialog] = useState(false);

  const [newRule, setNewRule] = useState<Partial<FirewallRule>>({
    name: '',
    priority: 100,
    direction: 'ingress',
    action: 'allow',
    protocol: 'tcp',
    sourceIp: '0.0.0.0/0',
    destinationIp: '*',
    port: '443',
    enabled: true,
  });

  const [newDNSRecord, setNewDNSRecord] = useState<Partial<DNSRecord>>({
    name: '',
    type: 'A',
    value: '',
    ttl: 3600,
    enabled: true,
  });

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard', description: text });
  };

  const handleRefreshTopology = () => {
    toast({ title: 'Refreshing topology', description: 'Network topology is being refreshed...' });
  };

  const handleAddRule = () => {
    toast({ title: 'Rule created', description: `Firewall rule "${newRule.name}" has been created.` });
    setShowAddRuleDialog(false);
    setNewRule({ name: '', priority: 100, direction: 'ingress', action: 'allow', protocol: 'tcp', sourceIp: '0.0.0.0/0', destinationIp: '*', port: '443', enabled: true });
  };

  const handleDeleteRule = (rule: FirewallRule) => {
    toast({ title: 'Rule deleted', description: `Firewall rule "${rule.name}" has been deleted.` });
  };

  const handleToggleRule = (rule: FirewallRule) => {
    toast({ title: rule.enabled ? 'Rule disabled' : 'Rule enabled', description: `Firewall rule "${rule.name}" has been ${rule.enabled ? 'disabled' : 'enabled'}.` });
  };

  const navItems = [
    { id: 'topology', label: 'Network Topology', icon: Network },
    { id: 'firewall', label: 'Firewall Rules', icon: Shield },
    { id: 'vpc', label: 'VPC Peering', icon: Link2 },
    { id: 'dns', label: 'DNS Management', icon: Globe },
    { id: 'ssl', label: 'SSL/TLS Certificates', icon: Lock },
    { id: 'zerotrust', label: 'Zero-Trust Policies', icon: Key },
    { id: 'traffic', label: 'Traffic Analytics', icon: BarChart3 },
    { id: 'ports', label: 'Port Forwarding', icon: Layers },
  ];

  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";
  const cardClassName = "border border-border bg-card shadow-sm";
  const switchClassName = "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted";

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Active' },
      healthy: { variant: 'default', label: 'Healthy' },
      pending: { variant: 'secondary', label: 'Pending' },
      warning: { variant: 'secondary', label: 'Warning' },
      failed: { variant: 'destructive', label: 'Failed' },
      expired: { variant: 'destructive', label: 'Expired' },
      error: { variant: 'destructive', label: 'Error' },
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
  };

  return (
    <PageShell>
      <div 
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        style={{ fontFamily: 'var(--ecode-font-sans)' }}
        data-testid="page-networking"
      >
        <PageHeader
          title="Network Control Plane"
          description="Configure networking, firewall rules, VPC peering, DNS, SSL certificates, and zero-trust policies."
          icon={Network}
          actions={(
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 border-border bg-card text-foreground hover:bg-muted hover:border-primary/30 transition-all duration-200"
                onClick={handleRefreshTopology}
                data-testid="button-refresh-topology"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button 
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
                onClick={() => setShowAddRuleDialog(true)}
                data-testid="button-add-rule"
              >
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </div>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          <div className="lg:col-span-1">
            <nav 
              className="space-y-1 p-2 rounded-xl border border-border bg-card"
              data-testid="nav-networking-sidebar"
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
          </div>

          <div className="lg:col-span-3 space-y-6">
            {activeTab === 'topology' && (
              <Card className={cardClassName} data-testid="card-network-topology">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Network Topology
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Visual representation of your network infrastructure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={Network}
                    title="No Network Nodes Configured"
                    description="Network topology visualization is available with Enterprise plans. Configure VPCs, subnets, load balancers, and gateways to visualize your infrastructure."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'firewall' && (
              <Card className={cardClassName} data-testid="card-firewall-rules">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Firewall Rules
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configure ingress and egress rules to control network traffic
                      </CardDescription>
                    </div>
                    <Dialog open={showAddRuleDialog} onOpenChange={setShowAddRuleDialog}>
                      <DialogTrigger asChild>
                        <Button className="gap-2" data-testid="button-add-firewall-rule">
                          <Plus className="h-4 w-4" />
                          Add Rule
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md" data-testid="dialog-add-rule">
                        <DialogHeader>
                          <DialogTitle>Add Firewall Rule</DialogTitle>
                          <DialogDescription>Create a new firewall rule to control network traffic.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label>Rule Name</Label>
                            <Input
                              value={newRule.name}
                              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                              placeholder="e.g., Allow HTTPS"
                              className={inputClassName}
                              data-testid="input-rule-name"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Direction</Label>
                              <Select value={newRule.direction} onValueChange={(v) => setNewRule({ ...newRule, direction: v as 'ingress' | 'egress' })}>
                                <SelectTrigger className={inputClassName} data-testid="select-direction">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ingress">Ingress</SelectItem>
                                  <SelectItem value="egress">Egress</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Action</Label>
                              <Select value={newRule.action} onValueChange={(v) => setNewRule({ ...newRule, action: v as 'allow' | 'deny' })}>
                                <SelectTrigger className={inputClassName} data-testid="select-action">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="allow">Allow</SelectItem>
                                  <SelectItem value="deny">Deny</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Protocol</Label>
                              <Select value={newRule.protocol} onValueChange={(v) => setNewRule({ ...newRule, protocol: v as 'tcp' | 'udp' | 'icmp' | 'all' })}>
                                <SelectTrigger className={inputClassName} data-testid="select-protocol">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tcp">TCP</SelectItem>
                                  <SelectItem value="udp">UDP</SelectItem>
                                  <SelectItem value="icmp">ICMP</SelectItem>
                                  <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Port</Label>
                              <Input
                                value={newRule.port}
                                onChange={(e) => setNewRule({ ...newRule, port: e.target.value })}
                                placeholder="443"
                                className={inputClassName}
                                data-testid="input-port"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Source IP</Label>
                            <Input
                              value={newRule.sourceIp}
                              onChange={(e) => setNewRule({ ...newRule, sourceIp: e.target.value })}
                              placeholder="0.0.0.0/0"
                              className={inputClassName}
                              data-testid="input-source-ip"
                            />
                          </div>
                          <div>
                            <Label>Priority</Label>
                            <Input
                              type="number"
                              value={newRule.priority}
                              onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                              placeholder="100"
                              className={inputClassName}
                              data-testid="input-priority"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddRuleDialog(false)} data-testid="button-cancel-rule">Cancel</Button>
                          <Button onClick={handleAddRule} data-testid="button-save-rule">Create Rule</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={Shield}
                    title="No Firewall Rules Configured"
                    description="Configure ingress and egress firewall rules to control network traffic. This feature is available with Enterprise plans."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'vpc' && (
              <Card className={cardClassName} data-testid="card-vpc-peering">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    VPC Peering Connections
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Manage connections between your Virtual Private Clouds
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={Link2}
                    title="No VPC Peering Connections"
                    description="Connect your Virtual Private Clouds across regions for secure, private networking. This feature is available with Enterprise plans."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'dns' && (
              <Card className={cardClassName} data-testid="card-dns-management">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        DNS Records
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Manage DNS records for your domains
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={Globe}
                    title="No DNS Records Configured"
                    description="Manage A, AAAA, CNAME, MX, TXT, and NS records for your domains. This feature is available with Enterprise plans."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'ssl' && (
              <Card className={cardClassName} data-testid="card-ssl-certificates">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        SSL/TLS Certificates
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Manage SSL/TLS certificates for secure connections
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={Lock}
                    title="No SSL Certificates Configured"
                    description="Manage SSL/TLS certificates with automatic renewal and custom certificate upload. This feature is available with Enterprise plans."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'zerotrust' && (
              <Card className={cardClassName} data-testid="card-zero-trust">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Zero-Trust Access Policies
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configure conditional access policies for enhanced security
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={Key}
                    title="No Zero-Trust Policies Configured"
                    description="Implement zero-trust security with conditional access policies based on IP ranges, countries, device types, and user groups. This feature is available with Enterprise plans."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'traffic' && (
              <Card className={cardClassName} data-testid="card-traffic-analytics">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Traffic Analytics
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Monitor network traffic, requests, bandwidth, and latency metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={BarChart3}
                    title="No Traffic Data Available"
                    description="Real-time traffic analytics including request rates, bandwidth usage, latency percentiles, and geographic distribution. This feature is available with Enterprise plans."
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'ports' && (
              <Card className={cardClassName} data-testid="card-port-forwarding">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Port Forwarding Rules
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configure port forwarding to route traffic to internal services
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={Layers}
                    title="No Port Forwarding Rules Configured"
                    description="Route external traffic to internal services with custom port mapping. This feature is available with Enterprise plans."
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
