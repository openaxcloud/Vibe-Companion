import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Product } from '../utils/types';
import * as productService from '../services/productService';
import { ArrowRight, ShoppingBag, Truck } from 'lucide-react';

const HomePage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await productService.getProducts();
        setProducts(data.slice(0, 4)); // Show a few featured products
      } catch (err) {
        setError('Failed to fetch products.');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-text-muted-light dark:text-text-muted-dark">
        Loading products...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="relative bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-700 dark:to-primary-900 text-white rounded-lg p-10 md:p-20 text-center shadow-lg overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/clean-textile.png')]"></div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
            Discover Your Next Favorite Item
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            High-quality products, unbeatable prices, seamless shopping experience.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center px-8 py-4 bg-white text-primary-700 dark:text-primary-900 font-semibold rounded-full shadow-lg hover:bg-primary-100 transition-all duration-300 transform hover:scale-105"
          >
            Shop Now <ArrowRight className="ml-2" />
          </Link>
        </div>
      </section>

      <section className="text-center">
        <h2 className="text-3xl font-bold text-text-light dark:text-text-dark mb-8">
          Featured Products
        </h2>
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-text-muted-light dark:text-text-muted-dark">No featured products available at the moment.</p>
        )}
        <div className="mt-8">
          <Link
            to="/products"
            className="inline-flex items-center px-6 py-3 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors duration-200"
          >
            View All Products <ArrowRight className="ml-2" size={18} />
          </Link>
        </div>
      </section>

      <section className="text-center bg-card-light dark:bg-card-dark glass-effect p-8 rounded-lg shadow-lg border border-border-light dark:border-border-dark">
        <h2 className="text-3xl font-bold text-text-light dark:text-text-dark mb-8">
          Why Shop With Us?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center p-6 bg-primary-50 dark:bg-primary-950 rounded-lg shadow-md">
            <ShoppingBag size={48} className="text-primary-600 dark:text-primary-400 mb-4" />
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-2">
              Wide Selection
            </h3>
            <p className="text-text-muted-light dark:text-text-muted-dark">
              Explore a diverse range of products to fit every need and style.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-primary-50 dark:bg-primary-950 rounded-lg shadow-md">
            <Truck size={48} className="text-primary-600 dark:text-primary-400 mb-4" />
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-2">
              Fast Shipping
            </h3>
            <p className="text-text-muted-light dark:text-text-muted-dark">
              Get your orders delivered quickly and reliably to your doorstep.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-primary-50 dark:bg-primary-950 rounded-lg shadow-md">
            <User size={48} className="text-primary-600 dark:text-primary-400 mb-4" />
            <h3 className="text-xl font-semibold text-text-light dark:text-text-dark mb-2">
              Customer Support
            </h3>
            <p className="text-text-muted-light dark:text-text-muted-dark">
              Our dedicated team is here to assist you with any questions or issues.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
