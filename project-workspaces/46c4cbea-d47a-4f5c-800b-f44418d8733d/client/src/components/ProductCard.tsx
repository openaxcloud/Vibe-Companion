import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { Star } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <Link
      to={`/products/${product.id}`}
      className="card-glass p-5 flex flex-col items-center text-center transform transition-all duration-300 ease-out hover:scale-105 hover:shadow-2xl group"
    >
      <div className="relative w-full h-48 mb-4 overflow-hidden rounded-md">
        <img
          src={product.imageUrl || 'https://via.placeholder.com/200x200?text=No+Image'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        {/* Optional: Add a quick-view overlay on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-white text-lg font-semibold">View Details</span>
        </div>
      </div>
      <h3 className="text-xl font-semibold text-slate-50 mb-2 group-hover:text-primary-400 transition-colors">
        {product.name}
      </h3>
      <p className="text-slate-400 text-sm mb-3 line-clamp-2">{product.description}</p>
      <div className="flex items-center justify-between w-full mt-auto">
        <span className="text-2xl font-bold text-accent-400">${product.price.toFixed(2)}</span>
        <div className="flex items-center text-yellow-400">
          <Star size={18} fill="currentColor" stroke="none" />
          <span className="ml-1 text-slate-300 text-sm">{product.rating ? product.rating.toFixed(1) : 'N/A'}</span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;