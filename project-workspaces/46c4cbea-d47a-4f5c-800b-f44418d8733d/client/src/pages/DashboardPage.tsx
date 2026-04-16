import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/Toast';
import * as orderApi from '../api/orders';
import * as productApi from '../api/products';
import { Order, Product } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { Package, ShoppingCart, Users, Settings } from 'lucide-react';

interface DashboardNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DashboardNav: React.FC<DashboardNavProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { name: 'Orders', icon: <ShoppingCart size={20} />, tab: 'orders' },
    { name: 'Products', icon: <Package size={20} />, tab: 'products' },
    { name: 'Users', icon: <Users size={20} />, tab: 'users' },
    { name: 'Settings', icon: <Settings size={20} />, tab: 'settings' },
  ];

  return (
    <nav className="flex-grow">
      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.tab}>
            <button
              onClick={() => onTabChange(item.tab)}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all duration-200
                ${activeTab === item.tab ? 'bg-primary-700 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
              `}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const OrdersManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedOrders = await orderApi.getOrders();
        setOrders(fetchedOrders);
      } catch (err) {
        setError('Failed to fetch orders.');
        toast.error('Failed to load orders.');
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-50 mb-6">Order Management</h2>
      <div className="card-glass p-6">
        {orders.length === 0 ? (
          <p className="text-slate-400">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-slate-300">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                    <td className="py-3 px-4">{order.id.substring(0, 8)}...</td>
                    <td className="py-3 px-4">{order.userEmail}</td>
                    <td className="py-3 px-4">${order.totalAmount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium
                        ${order.status === 'Pending' && 'bg-yellow-500/20 text-yellow-300'}
                        ${order.status === 'Completed' && 'bg-green-500/20 text-green-300'}
                        ${order.status === 'Cancelled' && 'bg-red-500/20 text-red-300'}
                      `}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <button className="text-primary-400 hover:text-primary-300 text-sm">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductsInventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedProducts = await productApi.getProducts();
        setProducts(fetchedProducts);
      } catch (err) {
        setError('Failed to fetch products for inventory.');
        toast.error('Failed to load product inventory.');
        console.error('Error fetching product inventory:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-50 mb-6">Product Inventory</h2>
      <div className="card-glass p-6">
        {products.length === 0 ? (
          <p className="text-slate-400">No products in inventory.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-slate-300">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="py-3 px-4">Product ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                    <td className="py-3 px-4">{product.id.substring(0, 8)}...</td>
                    <td className="py-3 px-4">{product.name}</td>
                    <td className="py-3 px-4">{product.category}</td>
                    <td className="py-3 px-4">${product.price.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium
                        ${product.inventory > 10 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}
                      `}>
                        {product.inventory}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button className="text-primary-400 hover:text-primary-300 text-sm mr-2">Edit</button>
                      <button className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]); // TODO: Define User type for dashboard
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data for now, replace with API call
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setUsers([
        { id: 'usr1', username: 'john_doe', email: 'john@example.com', role: 'customer', createdAt: new Date() },
        { id: 'usr2', username: 'jane_smith', email: 'jane@example.com', role: 'admin', createdAt: new Date() },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-50 mb-6">User Management</h2>
      <div className="card-glass p-6">
        {users.length === 0 ? (
          <p className="text-slate-400">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-slate-300">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                    <td className="py-3 px-4">{user.id.substring(0, 8)}...</td>
                    <td className="py-3 px-4">{user.username}</td>
                    <td className="py-3 px-4">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium
                        ${user.role === 'admin' ? 'bg-primary-500/20 text-primary-300' : 'bg-slate-500/20 text-slate-300'}
                      `}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <button className="text-primary-400 hover:text-primary-300 text-sm mr-2">Edit</button>
                      <button className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-50 mb-6">Settings</h2>
      <div className="card-glass p-6 text-slate-300">
        <p className="mb-4">Manage your marketplace settings here.</p>
        <p className="text-slate-400 text-sm">This section is under construction.</p>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('orders');

  useEffect(() => {
    // Redirect if user is not an admin, or to login if not authenticated
    if (!user) {
      navigate('/login');
      toast.info('Please log in to access the dashboard.');
    } else if (user.role !== 'admin') { // Assuming a 'role' field on the user object
      navigate('/'); // Redirect non-admin users to home
      toast.error('Access denied. You do not have administrator privileges.');
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return null; // Or a loading spinner/unauthorized message
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 py-8 animate-fade-in">
      <div className="w-full md:w-64">
        <DashboardNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div className="flex-grow card-glass p-8">
        {activeTab === 'orders' && <OrdersManagement />}
        {activeTab === 'products' && <ProductsInventory />}
        {activeTab === 'users' && <UsersManagement />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
};

export default DashboardPage;