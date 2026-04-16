import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Users, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from './Toast';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.info('You have been logged out.');
  };

  const navItems = [
    { name: 'Orders', icon: <ShoppingCart size={20} />, path: '/dashboard/orders' },
    { name: 'Products', icon: <Package size={20} />, path: '/dashboard/products' },
    { name: 'Users', icon: <Users size={20} />, path: '/dashboard/users' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/dashboard/settings' },
  ];

  return (
    <div className="w-full md:w-64 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg shadow-xl p-6 h-fit sticky top-28 animate-slide-up">
      <h2 className="text-2xl font-bold text-primary-400 mb-6">Admin Panel</h2>
      <nav className="flex flex-col space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200
              ${location.pathname === item.path ? 'bg-primary-700 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}
            `}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 p-3 rounded-lg text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors duration-200 w-full text-left mt-4"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;