import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ShoppingCart, User, LogOut, LogIn, PlusCircle, LayoutDashboard, ShoppingBag } from 'lucide-react';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled ? 'bg-slate-900/80 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
      <div className="container mx-auto flex items-center justify-between p-4 md:p-6 max-w-7xl">
        <Link to="/" className="flex items-center space-x-2 text-2xl font-bold text-primary-400 hover:text-primary-300 transition-colors">
          <ShoppingBag className="w-8 h-8" />
          <span>E-Commerce</span>
        </Link>

        <nav className="flex items-center space-x-4 md:space-x-6">
          <Link to="/products" className="text-slate-200 hover:text-white transition-colors text-lg font-medium hidden sm:block">
            Products
          </Link>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="relative text-slate-200 hover:text-white transition-colors group">
                <LayoutDashboard className="w-6 h-6" />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Dashboard</span>
              </Link>
              <button
                onClick={handleLogout}
                className="relative p-2 rounded-full bg-primary-700 hover:bg-primary-600 transition-colors text-white group"
                title="Logout"
              >
                <LogOut className="w-6 h-6" />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Logout</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="relative p-2 rounded-full bg-primary-700 hover:bg-primary-600 transition-colors text-white group"
              title="Login"
            >
              <LogIn className="w-6 h-6" />
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Login</span>
            </Link>
          )}
          <Link to="/cart" className="relative p-2 rounded-full bg-secondary-600 hover:bg-secondary-500 transition-colors text-white group" title="Cart">
            <ShoppingCart className="w-6 h-6" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {totalItems}
              </span>
            )}
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Cart</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
