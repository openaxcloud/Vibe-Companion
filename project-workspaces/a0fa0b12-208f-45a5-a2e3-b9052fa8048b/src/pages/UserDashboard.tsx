import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Order } from '../utils/types';
import * as orderService from '../services/orderService';
import { ShoppingBag, Package, Truck, XCircle, Clock } from 'lucide-react';

const UserDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserOrders = async () => {
      if (user && token) {
        setLoading(true);
        setError(null);
        try {
          const fetchedOrders = await orderService.getOrdersByUserId(token, user._id);
          setOrders(fetchedOrders);
        } catch (err) {
          setError('Failed to fetch orders.');
          console.error('Error fetching user orders:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchUserOrders();
  }, [user, token]);

  if (loading) {
    return (
      <div className="text-center py-12 text-text-muted-light dark:text-text-muted-dark">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-extrabold text-text-light dark:text-text-dark mb-6">
        Welcome, {user?.username}!
      </h1>

      <section className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark">
        <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4">Your Orders</h2>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
            <ShoppingBag size={48} className="mx-auto mb-4" />
            <p>You haven't placed any orders yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order._id} className="border border-border-light dark:border-border-dark rounded-md p-4 bg-primary-50 dark:bg-primary-950">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-lg text-text-light dark:text-text-dark">Order #{order._id.substring(0, 8)}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium
                    ${order.orderStatus === 'delivered' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'}
                    ${order.orderStatus === 'shipped' && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'}
                    ${order.orderStatus === 'processing' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}
                    ${order.orderStatus === 'pending' && 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'}
                    ${order.orderStatus === 'cancelled' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}
                  `}>
                    {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                  </span>
                </div>
                <p className="text-text-muted-light dark:text-text-muted-dark text-sm mb-2">Total: ${order.totalAmount.toFixed(2)}</p>
                <p className="text-text-muted-light dark:text-text-muted-dark text-sm">Ordered On: {new Date(order.createdAt).toLocaleDateString()}</p>
                <div className="mt-4">
                  <h4 className="font-medium text-text-light dark:text-text-dark mb-2">Items:</h4>
                  <ul className="list-disc list-inside text-text-muted-light dark:text-text-muted-dark text-sm">
                    {order.items.map((item, index) => (
                      <li key={index}>{item.product.name} (x{item.quantity}) - ${(item.priceAtPurchase * item.quantity).toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default UserDashboard;
