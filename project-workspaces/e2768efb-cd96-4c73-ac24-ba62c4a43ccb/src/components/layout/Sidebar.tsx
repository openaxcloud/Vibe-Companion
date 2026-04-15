import { Link } from 'react-router-dom';
import { Home, Package, ShoppingBag, Users, Settings, BarChart } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isActive }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 transition-all hover:bg-slate-800 hover:text-accent-400",
      isActive && "bg-slate-700 text-accent-400"
    )}
  >
    {icon}
    {label}
  </Link>
);

function Sidebar() {
  // const location = useLocation(); // Would use to determine active link
  // const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="hidden md:block w-64 border-r border-white/10 bg-slate-900 p-4 transition-all duration-300 ease-in-out">
      <nav className="flex flex-col gap-2">
        <NavItem to="/dashboard" icon={<Home className="h-5 w-5" />} label="Overview" isActive={true} /> {/* Placeholder active */}
        <NavItem to="/dashboard/products" icon={<Package className="h-5 w-5" />} label="Products" />
        <NavItem to="/dashboard/orders" icon={<ShoppingBag className="h-5 w-5" />} label="Orders" />
        <NavItem to="/dashboard/customers" icon={<Users className="h-5 w-5" />} label="Customers" />
        <NavItem to="/dashboard/analytics" icon={<BarChart className="h-5 w-5" />} label="Analytics" />
        <NavItem to="/dashboard/settings" icon={<Settings className="h-5 w-5" />} label="Settings" />
      </nav>
    </aside>
  );
}

export default Sidebar;
