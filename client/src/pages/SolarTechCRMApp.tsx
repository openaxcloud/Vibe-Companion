import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  FileText,
  Star,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Building,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  location: string;
  status: 'lead' | 'qualified' | 'proposal' | 'customer' | 'inactive';
  value: number;
  lastContact: Date;
  nextFollowup: Date;
  avatar?: string;
  notes: string;
  systemSize?: string;
  installationDate?: Date;
}

interface Deal {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  value: number;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability: number;
  closeDate: Date;
  systemSize: string;
  panelType: string;
}

export default function SolarTechCRMApp() {
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '+1 (555) 123-4567',
      company: 'Smith Residence',
      location: 'Austin, TX',
      status: 'qualified',
      value: 25000,
      lastContact: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      nextFollowup: new Date(Date.now() + 1000 * 60 * 60 * 24),
      notes: 'Interested in 8kW system for roof installation. Budget confirmed.',
      systemSize: '8kW',
      installationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@greencorp.com',
      phone: '+1 (555) 987-6543',
      company: 'GreenCorp Industries',
      location: 'Denver, CO',
      status: 'proposal',
      value: 150000,
      lastContact: new Date(Date.now() - 1000 * 60 * 60 * 24),
      nextFollowup: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      notes: 'Commercial installation for warehouse facility. Reviewing proposal.',
      systemSize: '100kW',
      installationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60)
    },
    {
      id: '3',
      name: 'Mike Wilson',
      email: 'mike.wilson@email.com',
      phone: '+1 (555) 456-7890',
      company: 'Wilson Family Home',
      location: 'Phoenix, AZ',
      status: 'customer',
      value: 30000,
      lastContact: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      nextFollowup: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      notes: 'System installed. Very satisfied. Referral potential.',
      systemSize: '10kW',
      installationDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    }
  ]);

  const [deals, setDeals] = useState<Deal[]>([
    {
      id: '1',
      customerId: '1',
      customerName: 'John Smith',
      title: 'Residential Solar Installation - 8kW',
      value: 25000,
      stage: 'qualified',
      probability: 75,
      closeDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      systemSize: '8kW',
      panelType: 'Monocrystalline'
    },
    {
      id: '2',
      customerId: '2',
      customerName: 'Sarah Johnson',
      title: 'Commercial Solar System - 100kW',
      value: 150000,
      stage: 'proposal',
      probability: 60,
      closeDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      systemSize: '100kW',
      panelType: 'Polycrystalline'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();

  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'lead': return 'bg-slate-500';
      case 'qualified': return 'bg-blue-500';
      case 'proposal': return 'bg-yellow-500';
      case 'customer': return 'bg-green-500';
      case 'inactive': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getDealStageColor = (stage: Deal['stage']) => {
    switch (stage) {
      case 'lead': return 'bg-slate-500';
      case 'qualified': return 'bg-blue-500';
      case 'proposal': return 'bg-yellow-500';
      case 'negotiation': return 'bg-orange-500';
      case 'closed-won': return 'bg-green-500';
      case 'closed-lost': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const avgDealSize = totalValue / deals.length;
  const winRate = (deals.filter(deal => deal.stage === 'closed-won').length / deals.length) * 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">SolarTech CRM</h1>
                <p className="text-muted-foreground">Customer Relationship Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </div>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Total Pipeline</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Active Deals</p>
                    <p className="text-2xl font-bold">{deals.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Avg Deal Size</p>
                    <p className="text-2xl font-bold">{formatCurrency(avgDealSize)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold">{winRate.toFixed(1)}%</p>
                  </div>
                  <Star className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          <Tabs defaultValue="customers" className="h-full">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="deals">Deal Pipeline</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Customer List */}
                <div className="lg:col-span-2">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Customers ({filteredCustomers.length})</span>
                        <Button variant="outline" size="sm">
                          <Filter className="h-4 w-4 mr-2" />
                          Filter
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-3">
                          {filteredCustomers.map((customer) => (
                            <Card
                              key={customer.id}
                              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                                selectedCustomer?.id === customer.id ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => setSelectedCustomer(customer)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <Avatar>
                                      <AvatarImage src={customer.avatar} />
                                      <AvatarFallback>
                                        {customer.name.split(' ').map(n => n[0]).join('')}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-medium">{customer.name}</h3>
                                        <Badge className={`text-[11px] ${getStatusColor(customer.status)} text-white`}>
                                          {customer.status}
                                        </Badge>
                                      </div>
                                      <p className="text-[13px] text-muted-foreground">{customer.company}</p>
                                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Mail className="h-3 w-3" />
                                          {customer.email}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {customer.location}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-primary">{formatCurrency(customer.value)}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Last: {formatDate(customer.lastContact)}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                {/* Customer Details */}
                <div>
                  {selectedCustomer ? (
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Customer Details</span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center">
                          <Avatar className="h-16 w-16 mx-auto mb-3">
                            <AvatarImage src={selectedCustomer.avatar} />
                            <AvatarFallback className="text-[15px]">
                              {selectedCustomer.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="font-semibold">{selectedCustomer.name}</h3>
                          <p className="text-[13px] text-muted-foreground">{selectedCustomer.company}</p>
                          <Badge className={`mt-2 ${getStatusColor(selectedCustomer.status)} text-white`}>
                            {selectedCustomer.status}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[13px]">{selectedCustomer.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[13px]">{selectedCustomer.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[13px]">{selectedCustomer.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[13px]">{selectedCustomer.systemSize || 'TBD'}</span>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-2">Notes</h4>
                          <p className="text-[13px] text-muted-foreground">{selectedCustomer.notes}</p>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-2">Next Steps</h4>
                          <div className="flex items-center gap-2 text-[13px]">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Follow up: {formatDate(selectedCustomer.nextFollowup)}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button className="flex-1">
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                          <Button variant="outline" className="flex-1">
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="h-full">
                      <CardContent className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Select a customer to view details</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="deals" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Deal Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {deals.map((deal) => (
                      <Card key={deal.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium">{deal.title}</h3>
                              <Badge className={`${getDealStageColor(deal.stage)} text-white`}>
                                {deal.stage}
                              </Badge>
                            </div>
                            <p className="text-[13px] text-muted-foreground mb-2">{deal.customerName}</p>
                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                              <span>System: {deal.systemSize}</span>
                              <span>Panels: {deal.panelType}</span>
                              <span>Close: {formatDate(deal.closeDate)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-[15px]">{formatCurrency(deal.value)}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={deal.probability} className="w-20" />
                              <span className="text-[13px] text-muted-foreground">{deal.probability}%</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}