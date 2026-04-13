import React from 'react';
import { ArrowRight } from 'lucide-react';

const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden py-36 md:py-48 flex items-center justify-center text-center">
      {/* Background gradient and subtle noise */}
      <div className="absolute inset-0 z-0 opacity-50">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-purple-950 animate-gradient-shift"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-white drop-shadow-lg mb-6">
          Pioneering Investments in <span className="text-primary-400">AI Data Centers</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 mb-10 leading-relaxed">
          Unlock the future of technology by investing in the foundational infrastructure of artificial intelligence. We connect visionary investors with high-growth AI data center opportunities.
        </p>
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <a
            href="#contact"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-primary-600 hover:bg-primary-700 md:py-4 md:text-lg md:px-10 shadow-lg transform transition-all duration-300 hover:scale-105 group"
          >
            Get Started <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
          </a>
          <a
            href="#about"
            className="inline-flex items-center justify-center px-8 py-3 border border-white/20 text-base font-medium rounded-full text-white bg-transparent hover:bg-white/10 md:py-4 md:text-lg md:px-10 shadow-lg transform transition-all duration-300 hover:scale-105"
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
