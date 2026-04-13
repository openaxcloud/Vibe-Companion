import React from 'react';

const dataCenters = [
  {
    name: "Nexa AI Data Center",
    location: "Silicon Valley, CA",
    description:
      "State-of-the-art AI data center featuring custom AI chips, advanced cooling systems, and 100% renewable energy.",
    imageUrl: "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Quantum Compute Hub",
    location: "Austin, TX",
    description:
      "High-performance facility optimized for quantum and AI workloads, emphasizing energy efficiency and scalability.",
    imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Arctic AI Facility",
    location: "Reykjavik, Iceland",
    description:
      "Eco-friendly data center leveraging cool climate and renewable geothermal energy to maximize efficiency.",
    imageUrl: "https://images.unsplash.com/photo-1497493292307-31c376b6e479?auto=format&fit=crop&w=800&q=80",
  },
];

const DataCenterShowcaseSection: React.FC = () => {
  return (
    <section id="data-centers" className="max-w-7xl mx-auto my-16 px-4">
      <h2 className="text-3xl font-bold mb-10 text-center">AI Data Center Portfolio</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {dataCenters.map(({ name, location, description, imageUrl }) => (
          <div key={name} className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl shadow-glow hover:shadow-primary-500 transition cursor-pointer overflow-hidden">
            <img src={imageUrl} alt={name} className="w-full h-48 object-cover" />
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-1">{name}</h3>
              <p className="text-sm text-primary-400 mb-2">{location}</p>
              <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DataCenterShowcaseSection;
