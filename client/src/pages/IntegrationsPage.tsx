import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Link,
  Search,
  Plus,
  Check,
  X,
  ExternalLink,
  Settings,
  Trash2,
  RefreshCw,
  Key,
  Webhook,
  Radio,
  Zap,
  Eye,
  EyeOff,
  Copy,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  Clock,
  Activity,
  ArrowRight,
  Play,
  Pause,
  Filter,
  Loader2,
  Globe,
  Code,
  Database,
  HeadphonesIcon,
  Server,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { SiGithub, SiSlack, SiJira, SiNotion, SiGitlab, SiDiscord, SiTrello, SiFigma, SiDatadog, SiSentry, SiGrafana, SiJenkins, SiVercel, SiMongodb, SiPostgresql, SiRedis, SiStripe } from 'react-icons/si';
import { Box, LineChart, Bell, Cloud, Mail, Users, Building2, Workflow as WorkflowIcon, CircleDot, Search as SearchIcon, MessageSquare, Headphones, Phone, Send } from 'lucide-react';

// Icon aliases for providers without SI icons
const SiAsana = Box;
const SiLinear = LineChart;
const SiZendesk = Headphones;
const SiPagerduty = Bell;
const SiNewrelic = LineChart;
const SiCircleci = CircleDot;
const SiGithubactions = WorkflowIcon;
const SiAmazons3 = Cloud;
const SiElasticsearch = SearchIcon;
const SiTwilio = Phone;
const SiSendgrid = Send;
const SiMailchimp = Mail;
const SiIntercom = MessageSquare;
const SiHubspot = Users;
const SiSalesforce = Building2;
const SiZapier = Zap;
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'cicd' | 'observability' | 'support' | 'data' | 'communication' | 'project' | 'payments' | 'automation';
  icon: typeof SiGithub;
  connected: boolean;
  status?: 'active' | 'error' | 'syncing';
  lastSync?: Date;
  config?: Record<string, string>;
  webhooksCount?: number;
  eventsCount?: number;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered?: Date;
  successRate: number;
  createdAt: Date;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

interface EventStream {
  id: string;
  name: string;
  destination: string;
  events: string[];
  active: boolean;
  throughput: number;
  createdAt: Date;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('browse');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [showAPIKeyDialog, setShowAPIKeyDialog] = useState(false);
  const [showStreamDialog, setShowStreamDialog] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: '1', name: 'GitHub', description: 'Connect your repositories for seamless code sync and CI/CD', category: 'cicd', icon: SiGithub, connected: true, status: 'active', lastSync: new Date(Date.now() - 300000), webhooksCount: 3, eventsCount: 1247 },
    { id: '2', name: 'Slack', description: 'Get notifications and updates directly in your Slack channels', category: 'communication', icon: SiSlack, connected: true, status: 'active', lastSync: new Date(Date.now() - 600000), webhooksCount: 5, eventsCount: 892 },
    { id: '3', name: 'Jira', description: 'Sync issues and track progress across your projects', category: 'project', icon: SiJira, connected: true, status: 'syncing', lastSync: new Date(Date.now() - 1800000) },
    { id: '4', name: 'Notion', description: 'Connect your Notion workspace for documentation sync', category: 'project', icon: SiNotion, connected: false },
    { id: '5', name: 'GitLab', description: 'Alternative Git hosting with built-in CI/CD pipelines', category: 'cicd', icon: SiGitlab, connected: false },
    { id: '6', name: 'Discord', description: 'Send notifications to your Discord server', category: 'communication', icon: SiDiscord, connected: false },
    { id: '7', name: 'Trello', description: 'Visual project management with boards and cards', category: 'project', icon: SiTrello, connected: false },
    { id: '8', name: 'Asana', description: 'Work management platform for teams', category: 'project', icon: SiAsana, connected: false },
    { id: '9', name: 'Figma', description: 'Design collaboration and handoff', category: 'project', icon: SiFigma, connected: true, status: 'active', lastSync: new Date(Date.now() - 3600000) },
    { id: '10', name: 'Linear', description: 'Streamline issues, sprints and product roadmaps', category: 'project', icon: SiLinear, connected: false },
    { id: '11', name: 'Zendesk', description: 'Customer service and support ticketing', category: 'support', icon: SiZendesk, connected: false },
    { id: '12', name: 'Datadog', description: 'Cloud monitoring and security platform', category: 'observability', icon: SiDatadog, connected: true, status: 'active', lastSync: new Date(Date.now() - 120000), eventsCount: 45678 },
    { id: '13', name: 'Sentry', description: 'Application monitoring and error tracking', category: 'observability', icon: SiSentry, connected: true, status: 'error' },
    { id: '14', name: 'PagerDuty', description: 'Incident management and on-call scheduling', category: 'observability', icon: SiPagerduty, connected: false },
    { id: '15', name: 'New Relic', description: 'Full-stack observability platform', category: 'observability', icon: SiNewrelic, connected: false },
    { id: '16', name: 'Grafana', description: 'Analytics and interactive visualization', category: 'observability', icon: SiGrafana, connected: false },
    { id: '17', name: 'Jenkins', description: 'Open source automation server', category: 'cicd', icon: SiJenkins, connected: false },
    { id: '18', name: 'CircleCI', description: 'Continuous integration and delivery', category: 'cicd', icon: SiCircleci, connected: false },
    { id: '19', name: 'GitHub Actions', description: 'Automate workflows directly in GitHub', category: 'cicd', icon: SiGithubactions, connected: true, status: 'active' },
    { id: '20', name: 'Vercel', description: 'Deploy and host modern web applications', category: 'cicd', icon: SiVercel, connected: true, status: 'active', lastSync: new Date(Date.now() - 900000) },
    { id: '21', name: 'AWS S3', description: 'Object storage for files and assets', category: 'data', icon: SiAmazons3, connected: false },
    { id: '22', name: 'MongoDB', description: 'Document database for modern apps', category: 'data', icon: SiMongodb, connected: false },
    { id: '23', name: 'PostgreSQL', description: 'Advanced open source database', category: 'data', icon: SiPostgresql, connected: true, status: 'active' },
    { id: '24', name: 'Redis', description: 'In-memory data structure store', category: 'data', icon: SiRedis, connected: false },
    { id: '25', name: 'Elasticsearch', description: 'Search and analytics engine', category: 'data', icon: SiElasticsearch, connected: false },
    { id: '26', name: 'Stripe', description: 'Payment processing and billing', category: 'payments', icon: SiStripe, connected: true, status: 'active', eventsCount: 3456 },
    { id: '27', name: 'Twilio', description: 'Cloud communications platform', category: 'communication', icon: SiTwilio, connected: false },
    { id: '28', name: 'SendGrid', description: 'Email delivery and marketing', category: 'communication', icon: SiSendgrid, connected: true, status: 'active' },
    { id: '29', name: 'Intercom', description: 'Customer messaging platform', category: 'support', icon: SiIntercom, connected: false },
    { id: '30', name: 'HubSpot', description: 'CRM and marketing automation', category: 'support', icon: SiHubspot, connected: false },
    { id: '31', name: 'Salesforce', description: 'CRM and enterprise cloud platform', category: 'support', icon: SiSalesforce, connected: false },
    { id: '32', name: 'Zapier', description: 'Connect and automate workflows', category: 'automation', icon: SiZapier, connected: true, status: 'active', webhooksCount: 8 },
  ]);

  const [webhooks, setWebhooks] = useState<Webhook[]>([
    { id: '1', name: 'Deployment Notifications', url: 'https://hooks.slack.com/services/xxx', events: ['deploy.success', 'deploy.fail'], active: true, lastTriggered: new Date(Date.now() - 3600000), successRate: 99.2, createdAt: new Date(Date.now() - 86400000 * 30) },
    { id: '2', name: 'GitHub PR Events', url: 'https://api.example.com/webhooks/pr', events: ['pr.opened', 'pr.merged', 'pr.closed'], active: true, lastTriggered: new Date(Date.now() - 1800000), successRate: 98.5, createdAt: new Date(Date.now() - 86400000 * 15) },
    { id: '3', name: 'Error Alerts', url: 'https://hooks.pagerduty.com/xxx', events: ['error.critical', 'error.warning'], active: true, lastTriggered: new Date(Date.now() - 7200000), successRate: 100, createdAt: new Date(Date.now() - 86400000 * 7) },
    { id: '4', name: 'Analytics Events', url: 'https://analytics.example.com/ingest', events: ['user.signup', 'user.login'], active: false, successRate: 95.0, createdAt: new Date(Date.now() - 86400000 * 60) },
  ]);

  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    { id: '1', name: 'Production API Key', key: 'ek_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', prefix: 'ek_live_', permissions: ['read', 'write', 'admin'], lastUsed: new Date(Date.now() - 60000), createdAt: new Date(Date.now() - 86400000 * 90) },
    { id: '2', name: 'Development Key', key: 'ek_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', prefix: 'ek_test_', permissions: ['read', 'write'], lastUsed: new Date(Date.now() - 3600000), createdAt: new Date(Date.now() - 86400000 * 30) },
    { id: '3', name: 'CI/CD Pipeline', key: 'ek_ci_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', prefix: 'ek_ci_', permissions: ['read', 'deploy'], lastUsed: new Date(Date.now() - 1800000), expiresAt: new Date(Date.now() + 86400000 * 60), createdAt: new Date(Date.now() - 86400000 * 14) },
  ]);

  const [eventStreams, setEventStreams] = useState<EventStream[]>([
    { id: '1', name: 'Analytics Pipeline', destination: 'AWS Kinesis', events: ['*'], active: true, throughput: 1250, createdAt: new Date(Date.now() - 86400000 * 45) },
    { id: '2', name: 'Audit Logs', destination: 'Elasticsearch', events: ['auth.*', 'api.*'], active: true, throughput: 450, createdAt: new Date(Date.now() - 86400000 * 30) },
  ]);

  const categories = [
    { id: 'all', label: 'All Integrations', icon: Link, count: integrations.length },
    { id: 'cicd', label: 'CI/CD', icon: Zap, count: integrations.filter(i => i.category === 'cicd').length },
    { id: 'observability', label: 'Observability', icon: BarChart3, count: integrations.filter(i => i.category === 'observability').length },
    { id: 'communication', label: 'Communication', icon: Globe, count: integrations.filter(i => i.category === 'communication').length },
    { id: 'project', label: 'Project Management', icon: Code, count: integrations.filter(i => i.category === 'project').length },
    { id: 'support', label: 'Support', icon: HeadphonesIcon, count: integrations.filter(i => i.category === 'support').length },
    { id: 'data', label: 'Data & Storage', icon: Database, count: integrations.filter(i => i.category === 'data').length },
    { id: 'payments', label: 'Payments', icon: ShieldCheck, count: integrations.filter(i => i.category === 'payments').length },
    { id: 'automation', label: 'Automation', icon: Server, count: integrations.filter(i => i.category === 'automation').length },
  ];

  const connectedIntegrations = integrations.filter(i => i.connected);

  const filteredIntegrations = integrations.filter((int) => {
    const matchesSearch = int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      int.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || int.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleConnect = async (integration: Integration) => {
    setIsConnecting(true);
    setSelectedIntegration(integration);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIntegrations(integrations.map(int => {
      if (int.id === integration.id) {
        return { ...int, connected: !int.connected, status: int.connected ? undefined : 'active', lastSync: int.connected ? undefined : new Date() };
      }
      return int;
    }));
    setIsConnecting(false);
    setShowConfigDialog(false);
    toast({
      title: integration.connected ? 'Disconnected' : 'Connected',
      description: `${integration.name} has been ${integration.connected ? 'disconnected' : 'connected'} successfully.`,
    });
  };

  const handleOpenConfig = (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowConfigDialog(true);
  };

  const handleToggleWebhook = (id: string) => {
    setWebhooks(webhooks.map(w => w.id === id ? { ...w, active: !w.active } : w));
    toast({ title: 'Webhook updated' });
  };

  const handleToggleStream = (id: string) => {
    setEventStreams(eventStreams.map(s => s.id === id ? { ...s, active: !s.active } : s));
    toast({ title: 'Event stream updated' });
  };

  const handleDeleteWebhook = (id: string) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
    toast({ title: 'Webhook deleted' });
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== id));
    toast({ title: 'API key revoked' });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const formatDate = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";
  const switchClassName = "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted";

  return (
    <PageShell>
      <div
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        data-testid="page-integrations"
      >
        <PageHeader
          title="Integration Hub"
          description="Connect your favorite tools and services to supercharge your workflow."
          icon={Link}
          actions={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowAPIKeyDialog(true)}
                data-testid="button-manage-api-keys"
              >
                <Key className="h-4 w-4" />
                API Keys
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowWebhookDialog(true)}
                data-testid="button-manage-webhooks"
              >
                <Webhook className="h-4 w-4" />
                Webhooks
              </Button>
              <Button
                className="gap-2"
                onClick={() => setShowStreamDialog(true)}
                data-testid="button-event-streaming"
              >
                <Radio className="h-4 w-4" />
                Event Streaming
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="md:col-span-1 space-y-4">
            <Card className={cardClassName} data-testid="card-integration-categories">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1 px-2 pb-4">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all ${
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        onClick={() => setSelectedCategory(cat.id)}
                        data-testid={`button-category-${cat.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {cat.label}
                        </div>
                        <Badge variant="secondary" className="text-[11px]">
                          {cat.count}
                        </Badge>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            <Card className={cardClassName} data-testid="card-connected-integrations">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[13px] font-medium">Connected</CardTitle>
                  <Badge variant="secondary">{connectedIntegrations.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[250px] px-2 pb-4">
                  <div className="space-y-2">
                    {connectedIntegrations.map((int) => {
                      const Icon = int.icon;
                      return (
                        <div
                          key={int.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-all"
                          onClick={() => handleOpenConfig(int)}
                          data-testid={`connected-integration-${int.id}`}
                        >
                          <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[13px] truncate">{int.name}</div>
                            <div className="flex items-center gap-1">
                              {int.status === 'active' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                              {int.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
                              {int.status === 'syncing' && <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />}
                              <span className="text-[11px] text-muted-foreground capitalize">{int.status}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-3 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-integrations">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <TabsList data-testid="tablist-integrations">
                  <TabsTrigger value="browse" data-testid="tab-browse">Browse All</TabsTrigger>
                  <TabsTrigger value="connected" data-testid="tab-connected">
                    Connected ({connectedIntegrations.length})
                  </TabsTrigger>
                  <TabsTrigger value="webhooks" data-testid="tab-webhooks">Webhooks</TabsTrigger>
                  <TabsTrigger value="api-keys" data-testid="tab-api-keys">API Keys</TabsTrigger>
                </TabsList>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search integrations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${inputClassName} pl-9`}
                    data-testid="input-search-integrations"
                  />
                </div>
              </div>

              <TabsContent value="browse" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-integrations">
                  {filteredIntegrations.map((int) => {
                    const Icon = int.icon;
                    return (
                      <Card
                        key={int.id}
                        className={`${cardClassName} cursor-pointer hover:border-primary/30 transition-all`}
                        onClick={() => handleOpenConfig(int)}
                        data-testid={`integration-card-${int.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground truncate">{int.name}</h3>
                                {int.connected && (
                                  <Badge
                                    variant="secondary"
                                    className={
                                      int.status === 'active' ? 'bg-green-500/10 text-green-600' :
                                      int.status === 'error' ? 'bg-red-500/10 text-red-600' :
                                      'bg-blue-500/10 text-blue-600'
                                    }
                                  >
                                    {int.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                                    {int.status === 'error' && <AlertCircle className="h-3 w-3 mr-0.5" />}
                                    {int.status === 'syncing' && <RefreshCw className="h-3 w-3 mr-0.5 animate-spin" />}
                                    {int.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{int.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                            <Badge variant="outline" className="text-[11px] capitalize">{int.category}</Badge>
                            <Button
                              size="sm"
                              variant={int.connected ? 'outline' : 'default'}
                              onClick={(e) => { e.stopPropagation(); handleConnect(int); }}
                              className="gap-1"
                              data-testid={`button-connect-${int.id}`}
                            >
                              {int.connected ? (
                                <>
                                  <Settings className="h-3.5 w-3.5" />
                                  Manage
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" />
                                  Connect
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="connected" className="mt-4">
                <div className="space-y-4" data-testid="list-connected">
                  {connectedIntegrations.map((int) => {
                    const Icon = int.icon;
                    return (
                      <Card key={int.id} className={cardClassName} data-testid={`connected-card-${int.id}`}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-foreground/5 flex items-center justify-center">
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{int.name}</h3>
                              <Badge
                                variant="secondary"
                                className={
                                  int.status === 'active' ? 'bg-green-500/10 text-green-600' :
                                  int.status === 'error' ? 'bg-red-500/10 text-red-600' :
                                  'bg-blue-500/10 text-blue-600'
                                }
                              >
                                {int.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-[13px] text-muted-foreground">
                              {int.lastSync && <span>Last sync: {formatDate(int.lastSync)}</span>}
                              {int.webhooksCount && <span>{int.webhooksCount} webhooks</span>}
                              {int.eventsCount && <span>{int.eventsCount.toLocaleString()} events</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" data-testid={`button-sync-${int.id}`}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenConfig(int)}
                              data-testid={`button-configure-${int.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleConnect(int)}
                              data-testid={`button-disconnect-${int.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="webhooks" className="mt-4">
                <Card className={cardClassName} data-testid="card-webhooks-list">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Webhooks</CardTitle>
                        <CardDescription>Manage outgoing webhook endpoints</CardDescription>
                      </div>
                      <Button className="gap-2" onClick={() => setShowWebhookDialog(true)} data-testid="button-create-webhook">
                        <Plus className="h-4 w-4" />
                        Create Webhook
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {webhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border"
                          data-testid={`webhook-${webhook.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${webhook.active ? 'bg-green-500/10' : 'bg-muted'}`}>
                              <Webhook className={`h-5 w-5 ${webhook.active ? 'text-green-600' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{webhook.name}</span>
                                <Badge variant={webhook.active ? 'default' : 'secondary'}>
                                  {webhook.active ? 'Active' : 'Paused'}
                                </Badge>
                              </div>
                              <div className="text-[13px] text-muted-foreground mt-0.5">
                                <code className="bg-muted px-1 rounded text-[11px]">{webhook.url}</code>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                                <span>{webhook.events.length} events</span>
                                <span>{webhook.successRate}% success</span>
                                {webhook.lastTriggered && <span>Last: {formatDate(webhook.lastTriggered)}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={webhook.active}
                              onCheckedChange={() => handleToggleWebhook(webhook.id)}
                              className={switchClassName}
                              data-testid={`switch-webhook-${webhook.id}`}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`button-webhook-menu-${webhook.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem>Edit</DropdownMenuItem>
                                <DropdownMenuItem>Test</DropdownMenuItem>
                                <DropdownMenuItem>View Logs</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteWebhook(webhook.id)}>Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="api-keys" className="mt-4">
                <Card className={cardClassName} data-testid="card-api-keys-list">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>API Keys</CardTitle>
                        <CardDescription>Manage your API keys for programmatic access</CardDescription>
                      </div>
                      <Button className="gap-2" onClick={() => setShowAPIKeyDialog(true)} data-testid="button-create-api-key">
                        <Plus className="h-4 w-4" />
                        Create API Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {apiKeys.map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border"
                          data-testid={`api-key-${key.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Key className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{key.name}</span>
                                {key.permissions.map(p => (
                                  <Badge key={p} variant="outline" className="text-[11px]">{p}</Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="bg-muted px-2 py-0.5 rounded text-[11px] font-mono">
                                  {showApiKey[key.id] ? key.key : `${key.prefix}${'•'.repeat(20)}`}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setShowApiKey({ ...showApiKey, [key.id]: !showApiKey[key.id] })}
                                  data-testid={`button-toggle-key-${key.id}`}
                                >
                                  {showApiKey[key.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleCopy(key.key)}
                                  data-testid={`button-copy-key-${key.id}`}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                                {key.lastUsed && <span>Last used: {formatDate(key.lastUsed)}</span>}
                                {key.expiresAt && <span>Expires: {key.expiresAt.toLocaleDateString()}</span>}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleRevokeKey(key.id)}
                            data-testid={`button-revoke-key-${key.id}`}
                          >
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          {selectedIntegration && (
            <DialogContent className="max-w-lg" data-testid="dialog-integration-config">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-foreground/5 flex items-center justify-center">
                    <selectedIntegration.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle>{selectedIntegration.name}</DialogTitle>
                    <DialogDescription>{selectedIntegration.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {selectedIntegration.connected ? (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-[13px] font-medium">Status</span>
                      <Badge className={
                        selectedIntegration.status === 'active' ? 'bg-green-500/10 text-green-600' :
                        selectedIntegration.status === 'error' ? 'bg-red-500/10 text-red-600' :
                        'bg-blue-500/10 text-blue-600'
                      }>
                        {selectedIntegration.status}
                      </Badge>
                    </div>
                    {selectedIntegration.lastSync && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                        <span className="text-[13px] font-medium">Last Synced</span>
                        <span className="text-[13px] text-muted-foreground">{formatDate(selectedIntegration.lastSync)}</span>
                      </div>
                    )}
                    <div>
                      <Label>Webhook URL</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={`https://api.ecode.dev/webhooks/${selectedIntegration.id}`}
                          readOnly
                          className={inputClassName}
                          data-testid="input-webhook-url"
                        />
                        <Button variant="outline" size="icon" onClick={() => handleCopy(`https://api.ecode.dev/webhooks/${selectedIntegration.id}`)} data-testid="button-copy-webhook">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Events to Subscribe</Label>
                      <Select defaultValue="all" data-testid="select-events">
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Events</SelectItem>
                          <SelectItem value="push">Push Events</SelectItem>
                          <SelectItem value="pr">Pull Requests</SelectItem>
                          <SelectItem value="issues">Issues</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>API Token</Label>
                      <Input
                        type="password"
                        placeholder="Enter your API token"
                        className={inputClassName}
                        data-testid="input-api-token"
                      />
                    </div>
                    <div>
                      <Label>Organization (optional)</Label>
                      <Input
                        placeholder="Your organization name"
                        className={inputClassName}
                        data-testid="input-organization"
                      />
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfigDialog(false)} data-testid="button-cancel-config">
                  Cancel
                </Button>
                {selectedIntegration.connected ? (
                  <>
                    <Button variant="outline" className="text-destructive" onClick={() => handleConnect(selectedIntegration)} data-testid="button-disconnect">
                      Disconnect
                    </Button>
                    <Button onClick={() => { setShowConfigDialog(false); toast({ title: 'Settings saved' }); }} data-testid="button-save-config">
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button disabled={isConnecting} onClick={() => handleConnect(selectedIntegration)} data-testid="button-connect">
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Connect {selectedIntegration.name}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
          <DialogContent className="max-w-lg" data-testid="dialog-create-webhook">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>Set up a new webhook endpoint to receive events</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Name</Label>
                <Input placeholder="My Webhook" className={inputClassName} data-testid="input-webhook-name" />
              </div>
              <div>
                <Label>Endpoint URL</Label>
                <Input placeholder="https://example.com/webhook" className={inputClassName} data-testid="input-webhook-endpoint" />
              </div>
              <div>
                <Label>Secret (optional)</Label>
                <Input type="password" placeholder="Webhook secret for verification" className={inputClassName} data-testid="input-webhook-secret" />
              </div>
              <div>
                <Label>Events</Label>
                <Select defaultValue="all" data-testid="select-webhook-events">
                  <SelectTrigger className={inputClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="deployments">Deployments</SelectItem>
                    <SelectItem value="errors">Errors</SelectItem>
                    <SelectItem value="users">User Events</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWebhookDialog(false)} data-testid="button-cancel-webhook">
                Cancel
              </Button>
              <Button onClick={() => { setShowWebhookDialog(false); toast({ title: 'Webhook created' }); }} data-testid="button-save-webhook">
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAPIKeyDialog} onOpenChange={setShowAPIKeyDialog}>
          <DialogContent className="max-w-lg" data-testid="dialog-create-api-key">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>Generate a new API key for programmatic access</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Name</Label>
                <Input placeholder="Production API Key" className={inputClassName} data-testid="input-key-name" />
              </div>
              <div>
                <Label>Permissions</Label>
                <Select defaultValue="read-write" data-testid="select-key-permissions">
                  <SelectTrigger className={inputClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read Only</SelectItem>
                    <SelectItem value="read-write">Read & Write</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiration</Label>
                <Select defaultValue="never" data-testid="select-key-expiration">
                  <SelectTrigger className={inputClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAPIKeyDialog(false)} data-testid="button-cancel-api-key">
                Cancel
              </Button>
              <Button onClick={() => { setShowAPIKeyDialog(false); toast({ title: 'API key created' }); }} data-testid="button-generate-key">
                Generate Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showStreamDialog} onOpenChange={setShowStreamDialog}>
          <DialogContent className="max-w-lg" data-testid="dialog-event-streaming">
            <DialogHeader>
              <DialogTitle>Event Streaming</DialogTitle>
              <DialogDescription>Configure real-time event streaming to external destinations</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                {eventStreams.map((stream) => (
                  <div key={stream.id} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`stream-${stream.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stream.active ? 'bg-green-500/10' : 'bg-muted'}`}>
                        <Radio className={`h-4 w-4 ${stream.active ? 'text-green-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="font-medium text-[13px]">{stream.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {stream.destination} • {stream.throughput}/min
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={stream.active}
                      onCheckedChange={() => handleToggleStream(stream.id)}
                      className={switchClassName}
                      data-testid={`switch-stream-${stream.id}`}
                    />
                  </div>
                ))}
              </div>

              <Separator />

              <div>
                <Label>Add New Stream</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input placeholder="Stream name" className={inputClassName} data-testid="input-stream-name" />
                  <Select defaultValue="kinesis" data-testid="select-stream-destination">
                    <SelectTrigger className={inputClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kinesis">AWS Kinesis</SelectItem>
                      <SelectItem value="kafka">Apache Kafka</SelectItem>
                      <SelectItem value="pubsub">Google Pub/Sub</SelectItem>
                      <SelectItem value="eventhub">Azure Event Hub</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStreamDialog(false)} data-testid="button-close-streaming">
                Close
              </Button>
              <Button onClick={() => { toast({ title: 'Stream created' }); }} data-testid="button-create-stream">
                Add Stream
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}
