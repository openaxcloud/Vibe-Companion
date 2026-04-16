import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService';
import { Product } from '../types';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productService.getProducts();
    res.status(200).json(products);
  } catch (error: any) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error: any) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = req.body;
  try {
    const newProduct = await productService.createProduct(productData);
    res.status(201).json(newProduct);
  } catch (error: any) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  const productData: Partial<Product> = req.body;
  try {
    const updatedProduct = await productService.updateProduct(req.params.id, productData);
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(updatedProduct);
  } catch (error: any) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await productService.deleteProduct(req.params.id);
    res.status(204).send(); // No content
  } catch (error: any) {
    next(error);
  }
};
