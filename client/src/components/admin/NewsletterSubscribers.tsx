import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Mail,
  Download,
  Search,
  CheckCircle,
  Calendar,
  Users,
  Activity,
  Send,
  Globe2,
  Clock,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface NewsletterSubscriber {
  id: number;
  email: string;
  isActive: boolean;
  subscribedAt: string;
  unsubscribedAt: string | null;
  confirmationToken: string | null;
  confirmedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  source: string | null;
  lastActivityAt: string | null;
  metadata?: Record<string, any> | null;
}

interface NewsletterStats {
  total: number;
  active: number;
  confirmed: number;
  unsubscribed: number;
  campaignsSent: number;
  lastSentAt: string | null;
  byCountry: { country: string; count: number }[];
  campaignsByStatus: Record<string, number>;
  recentFailures?: NewsletterFailure[];
}

interface NewsletterFailure {
  campaignId: number;
  email: string;
  error: string | null;
  sentAt: string | null;
}

export default function NewsletterSubscribers() {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [stats, setStats] = useState<NewsletterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnsubscribed, setShowUnsubscribed] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState('all');

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const response = await fetch('/api/newsletter/subscribers');
      if (response.ok) {
        const data = await response.json();
        setSubscribers(data.subscribers || []);
        setStats(data.stats || null);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch subscribers',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load newsletter subscribers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportSubscribers = () => {
    const activeSubscribers = subscribers.filter((s) => s.isActive);
    const csv = [
      'Email,Country,IP Address,Subscribed Date,Confirmed,Source',
      ...activeSubscribers.map((s) =>
        `${s.email},${(s.country || 'Unknown').replace(/,/g, ' ')},${(s.ipAddress || '').replace(/,/g, ' ')},${format(new Date(s.subscribedAt), 'yyyy-MM-dd')},${s.confirmedAt ? 'Yes' : 'No'},${(s.source || 'Unknown').replace(/,/g, ' ')}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-subscribers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalCount = stats?.total ?? subscribers.length;
  const activeCount = stats?.active ?? subscribers.filter((s) => s.isActive).length;
  const confirmedCount = stats?.confirmed ?? subscribers.filter((s) => s.confirmedAt).length;
  const unsubscribedCount = stats?.unsubscribed ?? (totalCount - activeCount);
  const campaignsSent = stats?.campaignsSent ?? 0;
  const lastSentLabel = stats?.lastSentAt ? format(new Date(stats.lastSentAt), 'MMM d, yyyy') : 'Never';
  const partialCount = stats?.campaignsByStatus?.partial ?? 0;
  const draftCount = stats?.campaignsByStatus?.draft ?? 0;

  const statusSummaryParts: string[] = [];
  if (partialCount > 0) statusSummaryParts.push(`${partialCount} partial`);
  if (draftCount > 0) statusSummaryParts.push(`${draftCount} draft`);
  const statusSummary = statusSummaryParts.length > 0 ? ` • ${statusSummaryParts.join(', ')}` : '';

  const filteredSubscribers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return subscribers.filter((subscriber) => {
      if (!showUnsubscribed && !subscriber.isActive) {
        return false;
      }

      const countryLabel = subscriber.country || 'Unknown';
      if (selectedCountry !== 'all' && countryLabel !== selectedCountry) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        subscriber.email,
        countryLabel,
        subscriber.ipAddress || '',
        subscriber.source || '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [subscribers, searchTerm, showUnsubscribed, selectedCountry]);

  const topCountries = stats?.byCountry?.slice(0, 5) ?? [];
  const hasCountryFilters = topCountries.length > 0;
  const campaignStatusEntries = useMemo(() => {
    if (!stats?.campaignsByStatus) {
      return [];
    }

    return Object.entries(stats.campaignsByStatus).sort((a, b) => b[1] - a[1]);
  }, [stats?.campaignsByStatus]);
  const recentFailures = stats?.recentFailures ?? [];
  const failureRows = useMemo(() => recentFailures.slice(0, 5), [recentFailures]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading subscribers...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-normal">Total Audience</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-[11px] text-muted-foreground">Contacts with a subscription record</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-normal">Active Subscribers</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">{unsubscribedCount} opted out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-normal">Confirmed Emails</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{confirmedCount}</p>
            <p className="text-[11px] text-muted-foreground">Double opt-in verified</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-normal">Campaigns Sent</CardTitle>
              <Send className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{campaignsSent}</p>
            <p className="text-[11px] text-muted-foreground">Last send: {lastSentLabel}{statusSummary}</p>
          </CardContent>
        </Card>
      </div>

      {campaignStatusEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Campaign status mix</CardTitle>
                <CardDescription>Real-time breakdown of newsletter lifecycle</CardDescription>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {campaignStatusEntries.map(([status, count]) => (
                <Badge key={status} variant="outline" className="capitalize">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasCountryFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Top Countries</CardTitle>
            <CardDescription>Where your subscribers are engaging from</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCountries.map(({ country, count }) => (
              <div key={country} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  <span>{country}</span>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {failureRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent delivery issues</CardTitle>
                <CardDescription>Last few failed sends to keep an eye on deliverability</CardDescription>
              </div>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failureRows.map((failure) => {
                  const failureKey = `${failure.campaignId}-${failure.email}-${failure.sentAt ?? 'unknown'}`;
                  const whenLabel = failure.sentAt
                    ? formatDistanceToNow(new Date(failure.sentAt), { addSuffix: true })
                    : 'Unknown';

                  return (
                    <TableRow key={failureKey}>
                      <TableCell className="font-mono text-[11px]">{failure.email}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {failure.error || 'No error returned'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">#{failure.campaignId}</Badge>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{whenLabel}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Newsletter Subscribers</CardTitle>
              <CardDescription>Manage your newsletter subscriber list</CardDescription>
            </div>
            <Button onClick={exportSubscribers} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div className="flex items-center gap-3">
              <Switch
                id="show-unsubscribed"
                checked={showUnsubscribed}
                onCheckedChange={setShowUnsubscribed}
              />
              <Label htmlFor="show-unsubscribed" className="text-[13px] text-muted-foreground">
                Include unsubscribed contacts
              </Label>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="sm:w-48">
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {stats?.byCountry?.map(({ country, count }) => (
                      <SelectItem key={country} value={country}>
                        {country} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, country, or IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confirmed</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No subscribers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscribers.map((subscriber) => {
                    const countryLabel = subscriber.country || 'Unknown';
                    return (
                      <TableRow key={subscriber.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {subscriber.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={subscriber.isActive ? 'default' : 'secondary'}>
                            {subscriber.isActive ? 'Active' : 'Unsubscribed'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {subscriber.confirmedAt ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{countryLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-[13px] text-muted-foreground">{subscriber.ipAddress || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[13px] text-muted-foreground">{subscriber.source || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(subscriber.subscribedAt), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {subscriber.lastActivityAt ? (
                            <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(subscriber.lastActivityAt), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
