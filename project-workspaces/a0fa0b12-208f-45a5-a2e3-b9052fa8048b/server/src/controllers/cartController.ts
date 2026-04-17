import { Request, Response } from 'express';
import { findCartByUserId, createCart, findCartItemsByCartId, findCartItemByProductAndCart, addCartItem, updateCartItemQuantity, removeCartItem, clearCartItems } from '../models/Cart';
import { findProductById } from '../models/Product';
import { CartItemPayload } from '../types';

export const getUserCart = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    let cart = await findCartByUserId(req.user.id);
    if (!cart) {
      cart = await createCart(req.user.id);
    }
    const cartItems = await findCartItemsByCartId(cart.id);
    res.status(200).json(cartItems.map(item => ({
      _id: item.id,
      product: { ...item.product, _id: item.product?.id, price: parseFloat(item.product?.price?.toString() || '0') },
      quantity: item.quantity,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addItemToUserCart = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const { productId, quantity } = req.body as CartItemPayload;

    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Not enough stock available.' });
    }

    let cart = await findCartByUserId(req.user.id);
    if (!cart) {
      cart = await createCart(req.user.id);
    }

    const existingCartItem = await findCartItemByProductAndCart(cart.id, productId);

    if (existingCartItem) {
      const newQuantity = existingCartItem.quantity + quantity;
      if (product.stock < newQuantity) {
        return res.status(400).json({ message: `Only ${product.stock} items of ${product.name} available. You have ${existingCartItem.quantity} in cart.` });
      }
      await updateCartItemQuantity(existingCartItem.id, newQuantity);
    } else {
      await addCartItem(cart.id, productId, quantity);
    }

    const updatedCartItems = await findCartItemsByCartId(cart.id);
    res.status(200).json(updatedCartItems.map(item => ({
      _id: item.id,
      product: { ...item.product, _id: item.product?.id, price: parseFloat(item.product?.price?.toString() || '0') },
      quantity: item.quantity,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const removeCartItemFromUserCart = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const { productId } = req.params;

    const cart = await findCartByUserId(req.user.id);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found.' });
    }

    const existingCartItem = await findCartItemByProductAndCart(cart.id, productId);
    if (!existingCartItem) {
      return res.status(404).json({ message: 'Item not in cart.' });
    }

    await removeCartItem(existingCartItem.id);
    const updatedCartItems = await findCartItemsByCartId(cart.id);
    res.status(200).json(updatedCartItems.map(item => ({
      _id: item.id,
      product: { ...item.product, _id: item.product?.id, price: parseFloat(item.product?.price?.toString() || '0') },
      quantity: item.quantity,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCartItemQuantityInUserCart = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be a positive number.' });
    }

    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ message: `Only ${product.stock} items of ${product.name} available.` });
    }

    const cart = await findCartByUserId(req.user.id);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found.' });
    }

    const existingCartItem = await findCartItemByProductAndCart(cart.id, productId);
    if (!existingCartItem) {
      return res.status(404).json({ message: 'Item not in cart.' });
    }

    await updateCartItemQuantity(existingCartItem.id, quantity);
    const updatedCartItems = await findCartItemsByCartId(cart.id);
    res.status(200).json(updatedCartItems.map(item => ({
      _id: item.id,
      product: { ...item.product, _id: item.product?.id, price: parseFloat(item.product?.price?.toString() || '0') },
      quantity: item.quantity,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const clearUserCart = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const cart = await findCartByUserId(req.user.id);
    if (!cart) {
      return res.status(200).json({ message: 'Cart already empty or not found.' });
    }

    await clearCartItems(cart.id);
    res.status(200).json({ message: 'Cart cleared successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
