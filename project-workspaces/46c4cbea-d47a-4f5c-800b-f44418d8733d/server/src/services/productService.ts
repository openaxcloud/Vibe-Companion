import * as ProductModel from '../models/Product';
import { Product } from '../types';

export const getProducts = async (): Promise<Product[]> => {
  return ProductModel.getProducts();
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
  return ProductModel.getProductById(id);
};

export const createProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
  return ProductModel.createProduct(productData);
};

export const updateProduct = async (id: string, productData: Partial<Product>): Promise<Product | undefined> => {
  return ProductModel.updateProduct(id, productData);
};

export const deleteProduct = async (id: string): Promise<void> => {
  return ProductModel.deleteProduct(id);
};
