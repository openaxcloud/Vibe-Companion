import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, Eye, 
  Globe, Calendar, Clock, Target, MousePointer,
  Smartphone, Monitor, MapPin, Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  overview: {
    totalVisits: number;
    uniqueVisitors: number;
    pageViews: number;
    bounceRate: number;
    avgSessionDuration: number;
    conversionRate: number;
  };
  traffic: {
    sources: Array<{ name: string; visitors: number; percentage: number }>;
    countries: Array<{ name: string; visitors: number; percentage: number }>;
    devices: Array<{ name: string; visitors: number; percentage: number }>;
  };
  pages: Array<{
    path: string;
    views: number;
    uniqueViews: number;
    avgTime: number;
    bounceRate: number;
  }>;
  realtime: {
    activeUsers: number;
    pageViews: number;
    topPages: Array<{ path: string; activeUsers: number }>;
  };
}

interface ReplitAnalyticsProps {
  projectId: number;
}

export function ReplitAnalytics({ projectId }: ReplitAnalyticsProps) {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    overview: {
      totalVisits: 0,
      uniqueVisitors: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      conversionRate: 0
    },
    traffic: {
      sources: [],
      countries: [],
      devices: []
    },
    pages: [],
    realtime: {
      activeUsers: 0,
      pageViews: 0,
      topPages: []
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [projectId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/${projectId}?period=${timeRange}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics Dashboard
          </h2>
          <p className="text-muted-foreground">
            Track your application's performance and user engagement
          </p>
        </div>
        
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={fetchAnalytics}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-[11px] text-muted-foreground">Total Visits</p>
                <p className="text-[15px] font-bold">{formatNumber(analytics.overview.totalVisits)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-[11px] text-muted-foreground">Unique Visitors</p>
                <p className="text-[15px] font-bold">{formatNumber(analytics.overview.uniqueVisitors)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-[11px] text-muted-foreground">Page Views</p>
                <p className="text-[15px] font-bold">{formatNumber(analytics.overview.pageViews)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-[11px] text-muted-foreground">Bounce Rate</p>
                <p className="text-[15px] font-bold">{analytics.overview.bounceRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-[11px] text-muted-foreground">Avg Session</p>
                <p className="text-[15px] font-bold">{formatDuration(analytics.overview.avgSessionDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-pink-600" />
              <div>
                <p className="text-[11px] text-muted-foreground">Conversion</p>
                <p className="text-[15px] font-bold">{analytics.overview.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="traffic">Traffic Sources</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Traffic Sources */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.traffic.sources.map((source, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          index === 0 ? 'bg-blue-500' :
                          index === 1 ? 'bg-green-500' :
                          index === 2 ? 'bg-purple-500' : 'bg-gray-400'
                        }`} />
                        <span className="text-[13px]">{source.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-medium">{formatNumber(source.visitors)}</p>
                        <p className="text-[11px] text-muted-foreground">{source.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Countries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Top Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.traffic.countries.map((country, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-[13px]">{country.name}</span>
                      <div className="text-right">
                        <p className="text-[13px] font-medium">{formatNumber(country.visitors)}</p>
                        <p className="text-[11px] text-muted-foreground">{country.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Devices */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.traffic.devices.map((device, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {device.name === 'Desktop' && <Monitor className="h-4 w-4" />}
                        {device.name === 'Mobile' && <Smartphone className="h-4 w-4" />}
                        {device.name === 'Tablet' && <Monitor className="h-4 w-4" />}
                        <span className="text-[13px]">{device.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-medium">{formatNumber(device.visitors)}</p>
                        <p className="text-[11px] text-muted-foreground">{device.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page Performance</CardTitle>
              <CardDescription>
                Most visited pages and their performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.pages.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No page data available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.pages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{page.path}</p>
                        <div className="flex gap-4 text-[13px] text-muted-foreground">
                          <span>{formatNumber(page.views)} views</span>
                          <span>{formatNumber(page.uniqueViews)} unique</span>
                          <span>{formatDuration(page.avgTime)} avg time</span>
                          <span>{page.bounceRate.toFixed(1)}% bounce</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {page.bounceRate < 40 ? (
                          <Badge className="text-green-600 bg-green-50 border-green-200">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Good
                          </Badge>
                        ) : page.bounceRate < 70 ? (
                          <Badge className="text-yellow-600 bg-yellow-50 border-yellow-200">
                            Average
                          </Badge>
                        ) : (
                          <Badge className="text-red-600 bg-red-50 border-red-200">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Poor
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Referral Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { source: 'Direct', visitors: 2847, change: 12.5 },
                    { source: 'Google Search', visitors: 1923, change: -3.2 },
                    { source: 'Social Media', visitors: 1456, change: 28.7 },
                    { source: 'Email', visitors: 892, change: 15.3 },
                    { source: 'Other', visitors: 634, change: -8.1 }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.source}</p>
                        <p className="text-[13px] text-muted-foreground">{formatNumber(item.visitors)} visitors</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {item.change > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-[13px] text-green-600">+{item.change}%</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="text-[13px] text-red-600">{item.change}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { keyword: 'web development', clicks: 234, impressions: 1892 },
                    { keyword: 'javascript tutorial', clicks: 189, impressions: 1456 },
                    { keyword: 'react components', clicks: 156, impressions: 1234 },
                    { keyword: 'css grid layout', clicks: 134, impressions: 987 },
                    { keyword: 'api integration', clicks: 98, impressions: 756 }
                  ].map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium">{item.keyword}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {((item.clicks / item.impressions) * 100).toFixed(1)}% CTR
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span>{item.clicks} clicks</span>
                        <span>{formatNumber(item.impressions)} impressions</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          {/* Real-time Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Activity className="h-8 w-8 mx-auto text-green-600 mb-2" />
                <p className="text-3xl font-bold text-green-600">{analytics.realtime.activeUsers}</p>
                <p className="text-[13px] text-muted-foreground">Active Users Right Now</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Eye className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                <p className="text-3xl font-bold">{analytics.realtime.pageViews}</p>
                <p className="text-[13px] text-muted-foreground">Page Views (Last 30 min)</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Globe className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                <p className="text-3xl font-bold">{analytics.realtime.topPages.length}</p>
                <p className="text-[13px] text-muted-foreground">Active Pages</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pages Being Viewed Right Now</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.realtime.topPages.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No active users right now</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.realtime.topPages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{page.path}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {page.activeUsers} active user{page.activeUsers !== 1 ? 's' : ''}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[13px] text-green-600">Live</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}