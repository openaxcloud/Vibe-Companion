import React from 'react';

const HeroSection: React.FC = () => {
  return (
    <section className="text-center pt-20 pb-16 max-w-4xl mx-auto">
      <h1 className="text-5xl font-extrabold leading-tight mb-6 bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
        Investing in the Future of AI Data Centers
      </h1>
      <p className="text-lg text-slate-300 mb-8">
        Harnessing cutting-edge AI infrastructure to power the world's most intelligent applications.
      </p>
      <a
        href="#contact"
        className="inline-block bg-primary-600 hover:bg-primary-700 active:scale-95 transition rounded-lg px-8 py-4 font-semibold shadow-glow"
      >
        Get in Touch
      </a>
    </section>
  );
};

export default HeroSection;
