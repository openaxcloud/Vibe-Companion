import { Request, Response } from 'express';
import { createOrder, addOrderItem, findOrdersByUserId, findAllOrders, updateOrder } from '../models/Order';
import { findCartItemsByCartId, findCartByUserId, clearCartItems } from '../models/Cart';
import { findProductById, updateProduct } from '../models/Product';
import { OrderPayload, OrderStatus } from '../types';
import { createCheckoutSession } from '../services/stripeService';
import { sendOrderConfirmationEmail } from '../services/emailService';

export const createNewOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const { items, shippingAddress, billingAddress, totalAmount } = req.body as OrderPayload;

    if (items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty. Cannot create an empty order.' });
    }

    // Verify stock and calculate actual total from product prices
    let verifiedTotalAmount = 0;
    const orderItemsWithProducts = [];
    for (const item of items) {
      const product = await findProductById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}.` });
      }
      verifiedTotalAmount += product.price * item.quantity;
      orderItemsWithProducts.push({ product, quantity: item.quantity, priceAtPurchase: product.price });
    }

    if (Math.abs(verifiedTotalAmount - totalAmount) > 0.01) { // Allow for float precision errors
      return res.status(400).json({ message: 'Total amount mismatch. Please refresh your cart.' });
    }

    // Create order in DB with pending payment status
    const newOrder = await createOrder({
      userId: req.user.id,
      totalAmount: verifiedTotalAmount,
      shippingAddress,
      billingAddress,
      paymentStatus: 'pending',
      orderStatus: 'pending',
    });

    // Add order items
    for (const item of orderItemsWithProducts) {
      await addOrderItem(newOrder.id, item.product.id, item.quantity, item.priceAtPurchase);
      // Reduce product stock
      await updateProduct(item.product.id, { stock: item.product.stock - item.quantity });
    }

    // Clear user's cart after creating order
    const userCart = await findCartByUserId(req.user.id);
    if (userCart) {
      await clearCartItems(userCart.id);
    }

    // Create Stripe Checkout Session
    const session = await createCheckoutSession(
      newOrder.id,
      req.user.id,
      orderItemsWithProducts.map(item => ({ product: item.product, quantity: item.quantity })),
      verifiedTotalAmount
    );

    // Update order with Stripe Session ID
    await updateOrder(newOrder.id, { paymentIntentId: session.id });

    res.status(201).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const orders = await findOrdersByUserId(req.user.id);
    res.status(200).json(orders.map(order => ({
      _id: order.id,
      user: { _id: order.userId, username: order.user?.username, email: order.user?.email },
      items: order.items?.map(item => ({ ...item, _id: item.id, product: { ...item.product, _id: item.product?.id, price: parseFloat(item.product?.price?.toString() || '0') } })),
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      totalAmount: parseFloat(order.totalAmount.toString()),
      paymentIntentId: order.paymentIntentId,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await findAllOrders();
    res.status(200).json(orders.map(order => ({
      _id: order.id,
      user: { _id: order.userId, username: order.user?.username, email: order.user?.email },
      items: order.items?.map(item => ({ ...item, _id: item.id, product: { ...item.product, _id: item.product?.id, price: parseFloat(item.product?.price?.toString() || '0') } })),
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      totalAmount: parseFloat(order.totalAmount.toString()),
      paymentIntentId: order.paymentIntentId,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: OrderStatus };

    const updatedOrder = await updateOrder(id, { orderStatus: status });
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    res.status(200).json({
      _id: updatedOrder.id,
      user: { _id: updatedOrder.userId }, // simplified user for this response
      items: [], // Not returning full items for this update
      shippingAddress: updatedOrder.shippingAddress,
      billingAddress: updatedOrder.billingAddress,
      paymentStatus: updatedOrder.paymentStatus,
      orderStatus: updatedOrder.orderStatus,
      totalAmount: parseFloat(updatedOrder.totalAmount.toString()),
      paymentIntentId: updatedOrder.paymentIntentId,
      createdAt: updatedOrder.created_at,
      updatedAt: updatedOrder.updated_at,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
