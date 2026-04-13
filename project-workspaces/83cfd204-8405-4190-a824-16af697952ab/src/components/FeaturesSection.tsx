import React from 'react';
import { Cpu, Database, ShieldCheck } from 'lucide-react';

const features = [
  {
    Icon: Cpu,
    title: 'Advanced AI Infrastructure',
    description:
      'Investing in powerful hardware and optimized AI compute environments tailored for maximum efficiency and scalability.',
  },
  {
    Icon: Database,
    title: 'Robust Data Security',
    description:
      'Implementing state-of-the-art security protocols to protect sensitive AI training data and computational resources.',
  },
  {
    Icon: ShieldCheck,
    title: 'Sustainable Practices',
    description:
      'Focusing on energy-efficient data centers powered by renewable energy sources to reduce environmental impact.',
  },
];

const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="max-w-5xl mx-auto my-16 px-4">
      <h2 className="text-3xl font-bold mb-8 text-center">Our Core Features</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {features.map(({ Icon, title, description }) => (
          <div
            key={title}
            className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl shadow-glow hover:shadow-primary-500 transition cursor-pointer"
          >
            <Icon className="text-primary-500 mb-4 mx-auto" size={48} />
            <h3 className="text-xl font-semibold mb-2 text-center">{title}</h3>
            <p className="text-slate-400 text-center">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturesSection;
