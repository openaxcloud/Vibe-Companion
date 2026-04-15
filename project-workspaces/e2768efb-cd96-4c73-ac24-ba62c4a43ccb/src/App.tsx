import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated } = useAuth(); // Placeholder for actual auth check

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        {isAuthenticated && <Sidebar />} {/* Show sidebar if authenticated, assuming it's for dashboard */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {isAuthenticated && <Route path="/dashboard" element={<DashboardPage />} />}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;