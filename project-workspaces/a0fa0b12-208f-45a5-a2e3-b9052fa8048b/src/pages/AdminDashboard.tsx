import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Order, Product, User } from '../utils/types';
import * as orderService from '../services/orderService';
import * as productService from '../services/productService';
import * as authService from '../services/authService';
import { Package, Users, ShoppingBag, Edit, Trash2, PlusCircle, Loader2 } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { token, isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'users'>('orders');

  useEffect(() => {
    if (!isAdmin()) {
      setError('Access Denied. You must be an administrator to view this page.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedOrders = await orderService.getAllOrders(token!);
        setOrders(fetchedOrders);
        const fetchedProducts = await productService.getProducts(); // Get all products
        setProducts(fetchedProducts);
        const fetchedUsers = await authService.getAllUsers(token!);
        setUsers(fetchedUsers);
      } catch (err) {
        setError('Failed to fetch dashboard data.');
        console.error('Error fetching admin data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, isAdmin]);

  const handleOrderStatusChange = async (orderId: string, newStatus: Order['orderStatus']) => {
    if (!token) return;
    try {
      setLoading(true);
      await orderService.updateOrderStatus(token, orderId, newStatus);
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order._id === orderId ? { ...order, orderStatus: newStatus } : order
        )
      );
      alert('Order status updated!'); // Placeholder
    } catch (err) {
      alert('Failed to update order status.'); // Placeholder
      console.error('Error updating order status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Placeholder functions for product/user management (actual implementation would involve modals/forms)
  const handleAddProduct = () => alert('Add Product functionality coming soon!');
  const handleEditProduct = (productId: string) => alert(`Edit Product ${productId} functionality coming soon!`);
  const handleDeleteProduct = async (productId: string) => {
    if (!token) return;
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        setLoading(true);
        await productService.deleteProduct(token, productId);
        setProducts(prev => prev.filter(p => p._id !== productId));
        alert('Product deleted!'); // Placeholder
      } catch (err) {
        alert('Failed to delete product.'); // Placeholder
        console.error('Error deleting product:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditUser = (userId: string) => alert(`Edit User ${userId} functionality coming soon!`);
  const handleDeleteUser = async (userId: string) => {
    if (!token) return;
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        setLoading(true);
        await authService.deleteUser(token, userId);
        setUsers(prev => prev.filter(u => u._id !== userId));
        alert('User deleted!'); // Placeholder
      } catch (err) {
        alert('Failed to delete user.'); // Placeholder
        console.error('Error deleting user:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-text-muted-light dark:text-text-muted-dark">
        <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />
        Loading admin dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500 text-lg">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-extrabold text-text-light dark:text-text-dark mb-6">
        Admin Dashboard
      </h1>

      <div className="flex border-b border-border-light dark:border-border-dark mb-8">
        <button
          className={`py-3 px-6 text-lg font-medium ${activeTab === 'orders' ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary-600 dark:hover:text-primary-400'} transition-colors duration-200`}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium ${activeTab === 'products' ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary-600 dark:hover:text-primary-400'} transition-colors duration-200`}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium ${activeTab === 'users' ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary-600 dark:hover:text-primary-400'} transition-colors duration-200`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
      </div>

      {activeTab === 'orders' && (
        <section className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4 flex items-center gap-2">
            <ShoppingBag size={24} /> All Orders
          </h2>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
              No orders found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-light dark:text-text-dark">{order._id.substring(0, 8)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">{order.user?.username || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">${order.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <select
                          value={order.orderStatus}
                          onChange={(e) => handleOrderStatusChange(order._id, e.target.value as Order['orderStatus'])}
                          className={`px-3 py-1 rounded-full text-sm font-medium border-none outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400
                            ${order.orderStatus === 'delivered' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'}
                            ${order.orderStatus === 'shipped' && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'}
                            ${order.orderStatus === 'processing' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}
                            ${order.orderStatus === 'pending' && 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'}
                            ${order.orderStatus === 'cancelled' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}
                          `}
                          disabled={loading}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link to={`/admin/orders/${order._id}`} className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 mr-3">Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'products' && (
        <section className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
              <Package size={24} /> Product Management
            </h2>
            <button
              onClick={handleAddProduct}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200"
            >
              <PlusCircle size={20} /> Add Product
            </button>
          </div>
          {products.length === 0 ? (
            <div className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
              No products found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {products.map((product) => (
                    <tr key={product._id} className="hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-light dark:text-text-dark">{product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">${product.price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">{product.stock}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center gap-2">
                        <button onClick={() => handleEditProduct(product._id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDeleteProduct(product._id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'users' && (
        <section className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4 flex items-center gap-2">
            <Users size={24} /> User Management
          </h2>
          {users.length === 0 ? (
            <div className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-light dark:text-text-dark">{user.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium
                          ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'}
                        `}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center gap-2">
                        <button onClick={() => handleEditUser(user._id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDeleteUser(user._id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminDashboard;
