import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import Card from '../components/ui/Card';
import { Order } from '../types';

const OrderHistoryPage: React.FC = () => {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      setError('You must be logged in to view your order history.');
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Order[]>(`/orders/user/${user.id}`, token);
        if (response.success && response.data) {
          setOrders(response.data);
        } else {
          setError(response.message || 'Failed to fetch order history.');
        }
      } catch (err) {
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user, token]);

  if (loading) {
    return <div className="text-center text-xl text-slate-300 animate-pulse">Loading order history...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 text-xl">{error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center p-8 animate-fade-in">
        <h1 className="text-4xl font-bold text-white mb-4">No Orders Yet</h1>
        <p className="text-lg text-slate-400 mb-8">Once you place an order, it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-4xl font-bold mb-8 text-white">Your Order History</h1>

      <div className="space-y-6">
        {orders.map((order) => (
          <Card key={order.id} className="p-6 animate-slide-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-700 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Order ID: {order.id.substring(0, 8)}</h2>
                <p className="text-slate-400 text-sm">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right mt-2 md:mt-0">
                <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full
                  ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : ''}
                  ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                  ${order.status === 'shipped' ? 'bg-blue-100 text-blue-800' : ''}
                  ${order.status === 'delivered' ? 'bg-green-100 text-green-800' : ''}
                  ${order.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
                <p className="text-2xl font-bold text-accent mt-1">Total: ${order.totalAmount.toFixed(2)}</p>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white mb-2">Items:</h3>
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 text-slate-300">
                  <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
                  <div>
                    <p className="font-medium">{item.name} (x{item.quantity})</p>
                    <p className="text-sm">${item.price.toFixed(2)} each</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OrderHistoryPage;