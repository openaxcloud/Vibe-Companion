import { Request, Response } from 'express';
import { createProduct, findProductById, findAllProducts, updateProduct, deleteProductById } from '../models/Product';
import { ProductPayload } from '../types';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    const products = await findAllProducts(
      search as string,
      category as string,
      minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice ? parseFloat(maxPrice as string) : undefined,
      sort as 'asc' | 'desc'
    );
    res.status(200).json(products.map(p => ({ ...p, _id: p.id, price: parseFloat(p.price.toString()) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ ...product, _id: product.id, price: parseFloat(product.price.toString()) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createNewProduct = async (req: Request, res: Response) => {
  try {
    const productData: ProductPayload = req.body;
    const newProduct = await createProduct(productData);
    res.status(201).json({ ...newProduct, _id: newProduct.id, price: parseFloat(newProduct.price.toString()) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateExistingProduct = async (req: Request, res: Response) => {
  try {
    const updatedProduct = await updateProduct(req.params.id, req.body);
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ ...updatedProduct, _id: updatedProduct.id, price: parseFloat(updatedProduct.price.toString()) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    await deleteProductById(req.params.id);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
