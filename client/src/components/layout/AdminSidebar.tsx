import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Users, 
  Key, 
  FileText, 
  Ticket, 
  CreditCard,
  Book,
  Activity,
  Settings,
  LogOut,
  Brain,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AdminSidebar() {
  const [location] = useLocation();

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/system-monitoring', icon: Server, label: 'System Monitoring' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/ai-models', icon: Brain, label: 'AI Models' },
    { path: '/admin/api-keys', icon: Key, label: 'API Keys' },
    { path: '/admin/cms', icon: FileText, label: 'CMS Pages' },
    { path: '/admin/docs', icon: Book, label: 'Documentation' },
    { path: '/admin/support', icon: Ticket, label: 'Support' },
    { path: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
    { path: '/admin/activity', icon: Activity, label: 'Activity Logs' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside aria-label="Admin navigation" className="w-64 bg-zinc-950 border-r border-zinc-800">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">Admin Panel</h1>
        <p className="text-[13px] text-zinc-400 mt-1">E-Code Administration</p>
      </div>
      
      <nav aria-label="Admin menu" className="px-4 pb-4">
        {navItems.map((item) => {
          const isActive = location === item.path || 
            (item.path !== '/admin' && location.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={`w-full justify-start mb-1 ${
                  isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="mr-3 h-4 w-4" aria-hidden="true" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white">
            <LogOut className="mr-3 h-4 w-4" />
            Exit Admin
          </Button>
        </Link>
      </div>
    </aside>
  );
}