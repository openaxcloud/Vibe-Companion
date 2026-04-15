import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 text-center animate-fade-in">
      <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
        Discover, Sell, and Thrive in Our <br />
        <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">E-Commerce Marketplace</span>
      </h1>
      <p className="text-xl text-slate-300 max-w-2xl mb-10 leading-relaxed">
        Your one-stop destination for unique products, seamless shopping experiences, and a vibrant community of sellers and buyers.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/products">
          <Button size="lg" variant="primary" className="text-lg px-8 py-3">
            Shop Now
          </Button>
        </Link>
        <Link to="/register">
          <Button size="lg" variant="outline" className="text-lg px-8 py-3">
            Become a Seller
          </Button>
        </Link>
      </div>
      <div className="mt-20">
        {/* Placeholder for future sections like Featured Products, How it Works, etc. */}
        <h2 className="text-4xl font-bold text-white mb-8">Why Choose Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-6 rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg transform hover:translate-y-[-5px] transition-all duration-300">
            <h3 className="text-2xl font-semibold text-primary-300 mb-3">Vast Selection</h3>
            <p className="text-slate-400">Explore millions of products from diverse categories.</p>
          </div>
          <div className="p-6 rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg transform hover:translate-y-[-5px] transition-all duration-300">
            <h3 className="text-2xl font-semibold text-accent-300 mb-3">Secure Payments</h3>
            <p className="text-slate-400">Powered by Stripe for safe and reliable transactions.</p>
          </div>
          <div className="p-6 rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg transform hover:translate-y-[-5px] transition-all duration-300">
            <h3 className="text-2xl font-semibold text-white mb-3">Global Community</h3>
            <p className="text-slate-400">Connect with buyers and sellers worldwide.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
