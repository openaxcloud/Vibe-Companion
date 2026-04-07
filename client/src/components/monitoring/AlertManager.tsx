import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Bell, BellOff, CheckCircle, XCircle, AlertTriangle, Info,
  Clock, ChevronRight, Settings, History, Filter, Search
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';

interface AlertManagerProps {
  alerts?: any;
}

export function AlertManager({ alerts }: AlertManagerProps) {
  const [selectedTab, setSelectedTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [showMuted, setShowMuted] = useState(false);

  // Acknowledge alert mutation
  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest('POST', `/api/monitoring/alerts/${alertId}/ack`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/alerts'] });
    }
  });

  // Mute alert mutation
  const muteAlert = useMutation({
    mutationFn: async ({ alertId, duration }: { alertId: string; duration?: number }) => {
      const response = await apiRequest('POST', `/api/monitoring/alerts/${alertId}/mute`, { duration });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/alerts'] });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'error': return 'destructive';
      case 'warning': return 'outline';
      case 'info': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const activeAlerts = alerts?.active || [];
  const alertRules = alerts?.rules || [];

  // Filter alerts
  const filteredAlerts = activeAlerts.filter((alert: any) => {
    if (!showMuted && alert.status === 'muted') return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (searchTerm && !alert.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="active">
              Active Alerts
              {activeAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {activeAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rules">Alert Rules</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={showMuted}
                onCheckedChange={setShowMuted}
                id="show-muted"
              />
              <Label htmlFor="show-muted" className="text-[13px]">
                Show Muted
              </Label>
            </div>
          </div>
        </div>

        <TabsContent value="active" className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-[15px] font-semibold">No Active Alerts</p>
                <p className="text-[13px] text-muted-foreground">All systems are operating normally</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                <LazyAnimatePresence>
                  {filteredAlerts.map((alert: any) => (
                    <LazyMotionDiv
                      key={alert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Card className={cn(
                        "border-l-4",
                        alert.severity === 'critical' && "border-l-red-500",
                        alert.severity === 'error' && "border-l-orange-500",
                        alert.severity === 'warning' && "border-l-yellow-500",
                        alert.severity === 'info' && "border-l-blue-500",
                        alert.status === 'muted' && "opacity-50"
                      )}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={getSeverityColor(alert.severity)}>
                                <span className="flex items-center gap-1">
                                  {getSeverityIcon(alert.severity)}
                                  {alert.severity}
                                </span>
                              </Badge>
                              {alert.status === 'acknowledged' && (
                                <Badge variant="outline">Acknowledged</Badge>
                              )}
                              {alert.status === 'muted' && (
                                <Badge variant="outline">
                                  <BellOff className="h-3 w-3 mr-1" />
                                  Muted
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {formatTimeAgo(alert.triggeredAt)}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="font-medium mb-2">{alert.message}</p>
                          {alert.details && (
                            <div className="text-[13px] text-muted-foreground space-y-1">
                              <p>Metric: {alert.details.metric}</p>
                              <p>Value: {alert.details.value} {alert.details.operator} {alert.details.threshold}</p>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 mt-4">
                            {alert.status !== 'acknowledged' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => acknowledgeAlert.mutate(alert.ruleId)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Acknowledge
                              </Button>
                            )}
                            
                            {alert.status !== 'muted' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => muteAlert.mutate({ alertId: alert.ruleId, duration: 60 })}
                              >
                                <BellOff className="h-3 w-3 mr-1" />
                                Mute 1h
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => muteAlert.mutate({ alertId: alert.ruleId })}
                              >
                                <Bell className="h-3 w-3 mr-1" />
                                Unmute
                              </Button>
                            )}
                            
                            <Button size="sm" variant="ghost">
                              View Details
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </LazyMotionDiv>
                  ))}
                </LazyAnimatePresence>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {alertRules.map((rule: any) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-[13px] text-muted-foreground">{rule.description}</p>
                        <div className="flex items-center gap-2 text-[11px]">
                          <Badge variant="outline">
                            {rule.condition.metric} {rule.condition.operator} {rule.condition.value}
                          </Badge>
                          {rule.cooldownMinutes && (
                            <span className="text-muted-foreground">
                              Cooldown: {rule.cooldownMinutes}m
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch checked={rule.enabled} />
                        <Button size="sm" variant="ghost">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Alert History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Alert history will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Alert Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notification Channels</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]">In-App Notifications</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]">Email Notifications</span>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]">Slack Notifications</span>
                    <Switch />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Quiet Hours</Label>
                <div className="flex items-center gap-2">
                  <Select defaultValue="22">
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>to</span>
                  <Select defaultValue="8">
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button className="w-full">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}