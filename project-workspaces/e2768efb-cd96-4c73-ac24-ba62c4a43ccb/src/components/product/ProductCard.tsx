import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItemToCart } = useCart();

  const handleAddToCart = () => {
    addItemToCart(product, 1);
  };

  return (
    <Card className="flex flex-col overflow-hidden transform hover:scale-[1.02] transition-transform duration-300 ease-in-out group">
      <Link to={`/products/${product.id}`} className="block overflow-hidden h-48">
        <img
          src={product.imageUrl || 'https://via.placeholder.com/400x300.png?text=No+Image'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
        />
      </Link>
      <CardHeader className="flex-grow pb-2">
        <CardTitle className="text-xl font-semibold text-white group-hover:text-primary-300 transition-colors">
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </CardTitle>
        <CardDescription className="text-sm text-slate-400 line-clamp-2">
          {product.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-2 pb-4">
        <span className="text-2xl font-bold text-accent-400">${product.price.toFixed(2)}</span>
        <Button variant="primary" size="sm" onClick={handleAddToCart}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
