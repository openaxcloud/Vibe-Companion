import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, ShoppingCart, Package, User, LogIn, UserPlus, LayoutDashboard, History, Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Button from './ui/Button';
import { useCart } from '../context/CartContext';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, onClick }) => (
  <li>
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 ease-in-out
        ${isActive
          ? 'bg-primary text-white shadow-lg'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  </li>
);

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { cartItemCount } = useCart();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-darker text-slate-100">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-darker border-b border-slate-800 p-4 flex items-center justify-between">
        <NavLink to="/" className="text-2xl font-bold text-white">
          Marketplace
        </NavLink>
        <Button variant="ghost" onClick={toggleSidebar}>
          {isSidebarOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark border-r border-slate-800 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:h-auto lg:flex-shrink-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <NavLink to="/" className="text-2xl font-bold text-white">
            E-Market
          </NavLink>
          <Button variant="ghost" onClick={toggleSidebar} className="lg:hidden">
            <X />
          </Button>
        </div>
        <nav className="p-6">
          <ul className="space-y-2">
            <NavItem to="/" icon={<Home size={20} />} label="Home" onClick={toggleSidebar} />
            <NavItem to="/products" icon={<Package size={20} />} label="Products" onClick={toggleSidebar} />
            <NavItem
              to="/cart"
              icon={
                <div className="relative">
                  <ShoppingCart size={20} />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-accent text-dark text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItemCount}
                    </span>
                  )}
                </div>
              }
              label="Cart"
              onClick={toggleSidebar}
            />
            {user ? (
              <>
                {user.role === 'admin' && (
                  <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={toggleSidebar} />
                )}
                <NavItem to="/orders" icon={<History size={20} />} label="My Orders" onClick={toggleSidebar} />
                <li>
                  <Button
                    onClick={() => {
                      logout();
                      toggleSidebar();
                    }}
                    variant="outline"
                    className="w-full text-left justify-start mt-4"
                  >
                    <User size={20} className="mr-3" /> Logout ({user.username})
                  </Button>
                </li>
              </>
            ) : (
              <>
                <NavItem to="/login" icon={<LogIn size={20} />} label="Login" onClick={toggleSidebar} />
                <NavItem to="/register" icon={<UserPlus size={20} />} label="Register" onClick={toggleSidebar} />
              </>
            )}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto animate-fade-in animate-slide-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;