import { Link } from 'react-router-dom';
import { ShoppingCart, User, Search, Menu } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

function Header() {
  const { isAuthenticated, logout } = useAuth();
  const { cartItems } = useCart();
  const totalCartItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-gradient-to-r from-slate-950 to-slate-900 shadow-lg backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-white hover:text-accent-400 transition-colors duration-200">
          <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">E-Comm</span>
          <span className="text-slate-200">Marketplace</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/products" className="text-slate-300 hover:text-accent-400 transition-colors duration-200 text-lg font-medium">Products</Link>
          {isAuthenticated && (
            <Link to="/dashboard" className="text-slate-300 hover:text-accent-400 transition-colors duration-200 text-lg font-medium">Dashboard</Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-accent-400">
            <Search className="h-5 w-5" />
          </Button>
          <Link to="/cart" className="relative text-slate-300 hover:text-accent-400 transition-colors duration-200">
            <ShoppingCart className="h-6 w-6" />
            {totalCartItems > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
                {totalCartItems}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-accent-400">
                <User className="h-6 w-6" />
              </Button>
              <Button onClick={logout} variant="outline" className="text-slate-300 hover:bg-slate-700">Logout</Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link to="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link to="/register">
                <Button variant="primary">Sign Up</Button>
              </Link>
            </div>
          )}
          <Button variant="ghost" size="icon" className="md:hidden text-slate-300 hover:text-accent-400">
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Header;
