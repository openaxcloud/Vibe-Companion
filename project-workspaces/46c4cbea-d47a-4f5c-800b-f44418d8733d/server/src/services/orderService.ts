import * as OrderModel from '../models/Order';
import * as ProductModel from '../models/Product';
import { Order, ShippingAddress, CheckoutItem } from '../types';

export const createNewOrder = async (
  userId: string,
  userEmail: string,
  shippingAddress: ShippingAddress,
  checkoutItems: CheckoutItem[]
): Promise<Order> => {
  let totalAmount = 0;
  const orderItems = [];

  for (const item of checkoutItems) {
    const product = await ProductModel.getProductById(item.productId);
    if (!product || product.inventory < item.quantity) {
      throw new Error(`Product ${item.name} is out of stock or insufficient quantity.`);
    }
    totalAmount += item.price * item.quantity;
    orderItems.push({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.imageUrl,
    });
    // Deduct from inventory
    await ProductModel.updateProductInventory(item.productId, -item.quantity);
  }

  const newOrder = await OrderModel.createOrder(userId, userEmail, shippingAddress, totalAmount, orderItems);
  return newOrder;
};

export const getOrders = async (userId?: string): Promise<Order[]> => {
  if (userId) {
    return OrderModel.getOrdersByUserId(userId);
  }
  return OrderModel.getAllOrders();
};

export const getOrderDetails = async (orderId: string): Promise<Order | undefined> => {
  return OrderModel.getOrderById(orderId);
};

export const updateOrderStatus = async (orderId: string, status: Order['status']): Promise<Order | undefined> => {
  return OrderModel.updateOrderStatus(orderId, status);
};
