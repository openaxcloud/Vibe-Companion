import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import Card from '../components/ui/Card';
import { Order, Product, User } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const DashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    category: '',
    stock: '',
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Access Denied: You must be an admin to view this page.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const productsRes = await api.get<Product[]>('/products', token);
        if (productsRes.success && productsRes.data) {
          setProducts(productsRes.data);
        } else {
          setError(productsRes.message || 'Failed to fetch products.');
          setLoading(false);
          return;
        }

        const ordersRes = await api.get<Order[]>('/orders', token);
        if (ordersRes.success && ordersRes.data) {
          setOrders(ordersRes.data);
        } else {
          setError(ordersRes.message || 'Failed to fetch orders.');
          setLoading(false);
          return;
        }

        const usersRes = await api.get<User[]>('/auth/users', token); // Assuming an admin endpoint for users
        if (usersRes.success && usersRes.data) {
          setUsers(usersRes.data);
        } else {
          setError(usersRes.message || 'Failed to fetch users.');
          setLoading(false);
          return;
        }

      } catch (err) {
        setError('An unexpected error occurred while fetching dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, token]);

  const handleProductChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewProduct((prev) => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' ? parseFloat(value) || '' : value,
    }));
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return setError('Authentication token missing.');

    try {
      const response = await api.post<Product>('/products', newProduct, token);
      if (response.success && response.data) {
        setProducts((prev) => [...prev, response.data!]);
        setNewProduct({
          name: '',
          description: '',
          price: '',
          imageUrl: '',
          category: '',
          stock: '',
        });
      } else {
        setError(response.message || 'Failed to add product.');
      }
    } catch (err) {
      setError('Error adding product.');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingProduct) return setError('Authentication token or product missing.');

    try {
      const response = await api.put<Product>(`/products/${editingProduct.id}`, editingProduct, token);
      if (response.success && response.data) {
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? response.data! : p))
        );
        setEditingProduct(null);
      } else {
        setError(response.message || 'Failed to update product.');
      }
    } catch (err) {
      setError('Error updating product.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!token) return setError('Authentication token missing.');

    try {
      const response = await api.delete(`/products/${productId}`, token);
      if (response.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      } else {
        setError(response.message || 'Failed to delete product.');
      }
    } catch (err) {
      setError('Error deleting product.');
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
  };

  const handleOrderUpdate = async (orderId: string, newStatus: Order['status']) => {
    if (!token) return setError('Authentication token missing.');
    try {
      const response = await api.put<Order>(`/orders/${orderId}`, { status: newStatus }, token);
      if (response.success && response.data) {
        setOrders((prev) => prev.map(order => order.id === orderId ? response.data! : order));
      } else {
        setError(response.message || 'Failed to update order status.');
      }
    } catch (err) {
      setError('Error updating order status.');
    }
  };

  if (loading) {
    return <div className="text-center text-xl text-slate-300 animate-pulse">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 text-xl">{error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-4xl font-bold mb-8 text-white">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <Card className="text-center">
          <h2 className="text-5xl font-extrabold text-accent">{products.length}</h2>
          <p className="text-slate-300 text-lg">Total Products</p>
        </Card>
        <Card className="text-center">
          <h2 className="text-5xl font-extrabold text-primary">{orders.length}</h2>
          <p className="text-slate-300 text-lg">Total Orders</p>
        </Card>
        <Card className="text-center">
          <h2 className="text-5xl font-extrabold text-secondary">{users.length}</h2>
          <p className="text-slate-300 text-lg">Total Users</p>
        </Card>
      </div>

      {/* Product Management */}
      <Card className="mb-10 animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">Product Management</h2>

        <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Input
            label="Product Name"
            name="name"
            value={editingProduct ? editingProduct.name : newProduct.name}
            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, name: e.target.value}) : handleProductChange(e)}
            required
          />
          <Input
            label="Category"
            name="category"
            value={editingProduct ? editingProduct.category : newProduct.category}
            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, category: e.target.value}) : handleProductChange(e)}
            required
          />
          <Input
            label="Description"
            name="description"
            value={editingProduct ? editingProduct.description : newProduct.description}
            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, description: e.target.value}) : handleProductChange(e)}
            required
          />
          <Input
            label="Image URL"
            name="imageUrl"
            value={editingProduct ? editingProduct.imageUrl : newProduct.imageUrl}
            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, imageUrl: e.target.value}) : handleProductChange(e)}
            required
          />
          <Input
            label="Price"
            type="number"
            name="price"
            value={editingProduct ? editingProduct.price : newProduct.price}
            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0}) : handleProductChange(e)}
            required
            step="0.01"
          />
          <Input
            label="Stock"
            type="number"
            name="stock"
            value={editingProduct ? editingProduct.stock : newProduct.stock}
            onChange={(e) => editingProduct ? setEditingProduct({...editingProduct, stock: parseInt(e.target.value) || 0}) : handleProductChange(e)}
            required
          />
          <div className="md:col-span-2 flex justify-end gap-4">
            {editingProduct && (
              <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                Cancel Edit
              </Button>
            )}
            <Button type="submit" variant="primary">
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead>
              <tr className="bg-slate-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-800 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-200">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">{product.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-accent">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">{product.stock}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="secondary" size="sm" onClick={() => handleEditClick(product)} className="mr-2">
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteProduct(product.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Order Management */}
      <Card className="mb-10 animate-fade-in delay-100">
        <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">Order Management</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead>
              <tr className="bg-slate-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-800 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-200">{order.id.substring(0, 8)}...</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">{order.userId.substring(0, 8)}...</td>
                  <td className="px-6 py-4 whitespace-nowrap text-accent">${order.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : ''}
                      ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${order.status === 'shipped' ? 'bg-blue-100 text-blue-800' : ''}
                      ${order.status === 'delivered' ? 'bg-green-100 text-green-800' : ''}
                      ${order.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                    `}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <select
                      value={order.status}
                      onChange={(e) => handleOrderUpdate(order.id, e.target.value as Order['status'])}
                      className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-md py-1 px-2 mr-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Management */}
      <Card className="animate-fade-in delay-200">
        <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">User Management</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead>
              <tr className="bg-slate-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-200">{u.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">{u.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}
                    `}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;