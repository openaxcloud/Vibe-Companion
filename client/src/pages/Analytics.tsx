import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Activity, 
  BarChart3, 
  Clock, 
  Users, 
  Globe, 
  TrendingUp, 
  Eye,
  Mouse,
  Smartphone,
  Monitor,
  MapPin,
  Calendar,
  Filter,
  Download,
  Share,
  Settings
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Types for analytics data
interface OverviewStat {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

interface TrafficSource {
  source: string;
  visitors: string;
  percentage: number;
}

interface TopPage {
  page: string;
  views: string;
  change: string;
}

interface DeviceData {
  device: string;
  percentage: number;
}

interface GeographicData {
  country: string;
  flag: string;
  users: string;
}

interface AnalyticsData {
  overview: OverviewStat[];
  trafficSources: TrafficSource[];
  topPages: TopPage[];
  deviceData: DeviceData[];
  geographicData: GeographicData[];
  chartData: any[];
  realtimeUsers: number;
}

interface RealtimeActivity {
  action: string;
  page: string;
  time: string;
  user: string;
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState('7d');
  
  // Fetch real analytics data from API
  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', timeRange],
    queryFn: async () => {
      return await apiRequest('GET', `/api/analytics?timeRange=${timeRange}`);
    },
    initialData: {
      overview: [],
      trafficSources: [],
      topPages: [],
      deviceData: [],
      geographicData: [],
      chartData: [],
      realtimeUsers: 0
    }
  });

  // Fetch real-time activity data
  const { data: realtimeActivityData, isLoading: realtimeLoading } = useQuery<{ activities: RealtimeActivity[] }>({
    queryKey: ['/api/analytics/realtime-activity'],
    queryFn: async () => {
      return await apiRequest('GET', '/api/analytics/realtime-activity');
    },
    staleTime: 10000,
    refetchInterval: 15000
  });
  const realtimeActivities = realtimeActivityData?.activities || [];
  
  const overviewStats = analyticsData?.overview || [
    { label: 'Total Views', value: '0', change: '0%', trend: 'up' as const },
    { label: 'Unique Visitors', value: '0', change: '0%', trend: 'up' as const },
    { label: 'Page Views', value: '0', change: '0%', trend: 'up' as const },
    { label: 'Avg. Session', value: '0s', change: '0%', trend: 'up' as const }
  ];

  const trafficSources = analyticsData?.trafficSources || [];
  const topPages = analyticsData?.topPages || [];
  const deviceData = analyticsData?.deviceData || [];
  const geographicData = analyticsData?.geographicData || [];
  const chartData = analyticsData?.chartData || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Track your project performance and user engagement</p>
          </div>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-time-range">
                  <Calendar className="h-4 w-4 mr-2" />
                  Last 7 days
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTimeRange('1d')}>Last 24 hours</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeRange('7d')}>Last 7 days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeRange('30d')}>Last 30 days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeRange('90d')}>Last 90 days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="outline" size="sm" data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button variant="outline" size="sm" data-testid="button-share">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {overviewStats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-muted-foreground">{stat.label}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold">{stat.value || '0'}</p>
                      {stat.change && (
                        <Badge 
                          variant={stat.trend === 'up' ? 'default' : 'secondary'}
                          className={stat.trend === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                          {stat.change}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-full">
                    {index === 0 && <Eye className="h-5 w-5 text-primary" />}
                    {index === 1 && <Users className="h-5 w-5 text-primary" />}
                    {index === 2 && <BarChart3 className="h-5 w-5 text-primary" />}
                    {index === 3 && <Clock className="h-5 w-5 text-primary" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="traffic" data-testid="tab-traffic">Traffic</TabsTrigger>
            <TabsTrigger value="pages" data-testid="tab-pages">Pages</TabsTrigger>
            <TabsTrigger value="audience" data-testid="tab-audience">Audience</TabsTrigger>
            <TabsTrigger value="realtime" data-testid="tab-realtime">Real-time</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Traffic Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Traffic Overview</CardTitle>
                  <CardDescription>Page views and unique visitors over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={256}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="views" stroke="#8884d8" fillOpacity={1} fill="url(#colorViews)" />
                      <Area type="monotone" dataKey="visitors" stroke="#82ca9d" fillOpacity={1} fill="url(#colorVisitors)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top Referrers */}
              <Card>
                <CardHeader>
                  <CardTitle>Traffic Sources</CardTitle>
                  <CardDescription>Where your visitors come from</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {trafficSources.map((source, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{source.source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <Progress value={source.percentage} className="h-2" />
                          </div>
                          <span className="text-[13px] text-muted-foreground w-12 text-right">
                            {source.visitors}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="traffic" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Traffic Trends</CardTitle>
                  <CardDescription>Detailed traffic analysis over the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="views" stroke="#8884d8" activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="visitors" stroke="#82ca9d" />
                      <Line type="monotone" dataKey="bounceRate" stroke="#ffc658" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Traffic Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {trafficSources.map((source, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-[13px]">
                          <span>{source.source}</span>
                          <span>{source.percentage}%</span>
                        </div>
                        <Progress value={source.percentage} />
                        <p className="text-[11px] text-muted-foreground">{source.visitors} visitors</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
                <CardDescription>Most visited pages on your site</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-full p-2">
                          <Activity className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{page.page}</p>
                          <p className="text-[13px] text-muted-foreground">{page.views} views</p>
                        </div>
                      </div>
                      <Badge variant={page.change && page.change.startsWith('+') ? 'default' : 'secondary'}>
                        {page.change || '0%'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audience" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Device Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Device Types</CardTitle>
                  <CardDescription>How users access your site</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {deviceData.map((device, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {device.device === 'Desktop' && <Monitor className="h-4 w-4 text-muted-foreground" />}
                          {device.device === 'Mobile' && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                          {device.device === 'Tablet' && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium">{device.device}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <Progress value={device.percentage} className="h-2" />
                          </div>
                          <span className="text-[13px] text-muted-foreground w-12 text-right">
                            {device.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Geographic Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Geographic Distribution</CardTitle>
                  <CardDescription>Where your users are located</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {geographicData.map((country, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px]">{country.flag}</span>
                          <span className="font-medium">{country.country}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-muted-foreground">
                            {country.users} users
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="realtime" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Active Users</CardTitle>
                  <CardDescription>Users currently on your site</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-5xl font-bold text-green-600 mb-2 animate-pulse">
                      {analyticsData?.realtimeUsers || 0}
                    </div>
                    <p className="text-[13px] text-muted-foreground">Active right now</p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-[11px] text-green-600">Live</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Live Activity Feed</CardTitle>
                  <CardDescription>Real-time user actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {realtimeLoading ? (
                      <p className="text-[13px] text-muted-foreground text-center py-4">Loading activity...</p>
                    ) : realtimeActivities.length > 0 ? (
                      realtimeActivities.slice(0, 5).map((activity, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <div>
                              <p className="text-[13px] font-medium">{activity.action}</p>
                              <p className="text-[11px] text-muted-foreground">{activity.user} • {activity.page}</p>
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{activity.time}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-muted-foreground text-center py-4">No recent activity</p>
                    )}
                  </div>
                </CardContent>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[13px]">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>User viewed /dashboard</span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px]">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span>New user signed up</span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px]">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span>Project created</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Page Views (Last Hour)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">127</div>
                    <p className="text-[13px] text-muted-foreground">+15% vs previous hour</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Active Pages</CardTitle>
                <CardDescription>Pages currently being viewed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['/dashboard', '/project/my-app', '/bounties', '/learn'].map((page, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-mono text-[13px]">{page}</span>
                      <Badge variant="outline">{index + 2} users</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}