import { Request, Response } from 'express';
import { findAllProducts, findProductById, insertProduct, Product, updateProductStock } from '../models/product.model';

export const getProducts = async (req: Request, res: Response) => {
  const { search, category, minPrice, maxPrice } = req.query;

  try {
    const products = await findAllProducts(
      search as string,
      category as string,
      minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice ? parseFloat(maxPrice as string) : undefined
    );
    res.status(200).json(products);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const { name, description, price, image_url, stock, category } = req.body;

  if (!name || !price || !stock) {
    return res.status(400).json({ message: 'Name, price, and stock are required' });
  }

  try {
    const newProduct = await insertProduct({ name, description, price, image_url, stock, category });
    res.status(201).json(newProduct);
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price, image_url, stock, category } = req.body;

  try {
    const existingProduct = await findProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedFields: Partial<Product> = {};
    if (name) updatedFields.name = name;
    if (description) updatedFields.description = description;
    if (price !== undefined) updatedFields.price = price;
    if (image_url) updatedFields.image_url = image_url;
    if (stock !== undefined) updatedFields.stock = stock;
    if (category) updatedFields.category = category;

    // A more robust update would involve a separate SQL query or ORM update method.
    // For now, this is a simplified example focusing on stock.
    if (stock !== undefined) {
      await updateProductStock(id, stock);
      res.status(200).json({ message: 'Product updated successfully, specifically stock for now.' });
    } else {
      res.status(200).json({ message: 'Product update received, but no specific logic for non-stock fields yet.' });
    }

  } catch (error: any) {
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};
