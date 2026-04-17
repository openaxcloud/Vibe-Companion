import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string;
    stock: number;
  };
  onAddToCart: (product: any, quantity: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const imageUrl = product.image_url || 'https://via.placeholder.com/400x300.png?text=No+Image';

  return (
    <div className="card-glass p-4 flex flex-col items-center text-center group relative overflow-hidden transition-all duration-300 hover:shadow-glow">
      <Link to={`/products/${product.id}`} className="block w-full">
        <div className="relative w-full h-48 mb-4 overflow-hidden rounded-md">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-primary-300 transition-colors">
          {product.name}
        </h3>
        <p className="text-slate-400 text-sm mb-3 line-clamp-2">{product.description}</p>
        <p className="text-2xl font-bold text-secondary-400 mb-4">${product.price.toFixed(2)}</p>
      </Link>

      <div className="flex items-center justify-between w-full px-2">
        {product.stock > 0 ? (
          <button
            onClick={() => onAddToCart(product, 1)}
            className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-2 px-4 rounded-full transition-all duration-300 flex items-center justify-center space-x-2 text-lg"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Add to Cart</span>
          </button>
        ) : (
          <span className="flex-1 bg-gray-700 text-gray-400 py-2 px-4 rounded-full text-lg cursor-not-allowed">Out of Stock</span>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
