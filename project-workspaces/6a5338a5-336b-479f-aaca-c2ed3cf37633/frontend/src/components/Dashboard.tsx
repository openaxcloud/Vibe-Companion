import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchOrders, updateOrderStatus } from '../api';
import toast from 'react-hot-toast';
import { Package, Truck, CheckCircle, XCircle } from 'lucide-react';

interface Order {
  id: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  shipping_address: string;
  billing_address: string;
}

const Dashboard: React.FC = () => {
  const { user, token, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    const getOrders = async () => {
      try {
        const fetchedOrders = await fetchOrders(token);
        setOrders(fetchedOrders);
      } catch (error: any) {
        toast.error(error.message || 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };
    getOrders();
  }, [isAuthenticated, token]);

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    if (!token) return;
    try {
      await updateOrderStatus(orderId, newStatus, token);
      setOrders(prevOrders => prevOrders.map(order =>
        order.id === orderId ? { ...order, status: newStatus, updated_at: new Date().toISOString() } : order
      ));
      toast.success(`Order ${orderId} status updated to ${newStatus}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order status');
    }
  };

  if (loading) {
    return <div className="text-center text-primary-400 text-xl py-10">Loading dashboard...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="card-glass p-8 max-w-md mx-auto my-10 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
        <p className="text-slate-400 mb-6">Please log in to view your dashboard.</p>
        <Link to="/login" className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="card-glass p-8 my-8">
      <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">Welcome, {user?.name || 'User'}!</h2>
      <p className="text-xl text-slate-300 mb-8">Here you can manage your orders and profile.</p>

      <h3 className="text-2xl font-bold text-white mb-5">Your Recent Orders</h3>

      {orders.length === 0 ? (
        <p className="text-slate-400 text-center text-lg py-10">You haven't placed any orders yet. <Link to="/products" className="text-primary-400 hover:underline">Start shopping!</Link></p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => (
            <div key={order.id} className="card-glass p-6 relative hover:shadow-glow transition-all duration-300">
              <div classNameName="flex items-center justify-between mb-4">
                <h4 className="text-xl font-semibold text-primary-300">Order #{order.id.substring(0, 8)}...</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium
                  ${order.status === 'paid' ? 'bg-green-600/20 text-green-400' :
                    order.status === 'shipped' ? 'bg-blue-600/20 text-blue-400' :
                    order.status === 'delivered' ? 'bg-secondary-600/20 text-secondary-400' :
                    order.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                    'bg-yellow-600/20 text-yellow-400'
                  }`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
              <p className="text-slate-400 mb-2">Total: <span className="font-bold text-white">${order.total_amount.toFixed(2)}</span></p>
              <p className="text-slate-500 text-sm mb-4">Ordered on: {new Date(order.created_at).toLocaleDateString()}</p>

              <div className="border-t border-slate-800 pt-4 mt-4">
                <p className="text-slate-400 mb-2">Shipping to: <span className="text-white">{order.shipping_address}</span></p>
              </div>

              {/* Example of admin-like functionality, normally protected by roles */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => handleUpdateStatus(order.id, 'shipped')}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-700/30 text-blue-300 rounded-full text-sm hover:bg-blue-700/50 transition-colors"
                >
                  <Truck className="w-4 h-4" /> <span>Ship</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus(order.id, 'delivered')}
                  className="flex items-center space-x-1 px-3 py-1 bg-secondary-700/30 text-secondary-300 rounded-full text-sm hover:bg-secondary-700/50 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> <span>Deliver</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-700/30 text-red-300 rounded-full text-sm hover:bg-red-700/50 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> <span>Cancel</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
