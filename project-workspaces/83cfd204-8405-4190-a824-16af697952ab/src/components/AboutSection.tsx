import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="max-w-6xl mx-auto my-16 px-4">
      <h2 className="text-3xl font-bold mb-6 text-center">About AI Data Invest</h2>
      <p className="text-center max-w-4xl mx-auto text-slate-300 leading-relaxed">
        AI Data Invest is a cutting-edge investment company focused exclusively on the AI data center sector. We capitalize on the rapid growth of artificial intelligence by investing in the most advanced, energy-efficient, and scalable data infrastructure.
      </p>
      <p className="text-center max-w-4xl mx-auto mt-4 text-slate-400 leading-relaxed">
        Our team of experts combines deep technological knowledge with strong financial acumen to identify and nurture a portfolio of AI data centers that lead the industry in innovation and sustainability.
      </p>
    </section>
  );
};

export default AboutSection;
