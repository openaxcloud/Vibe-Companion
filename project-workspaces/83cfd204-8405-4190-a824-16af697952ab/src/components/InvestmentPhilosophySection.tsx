import React from 'react';

const InvestmentPhilosophySection: React.FC = () => {
  return (
    <section id="investment" className="max-w-6xl mx-auto my-16 px-4">
      <h2 className="text-3xl font-bold mb-6 text-center">Our Investment Philosophy</h2>
      <ul className="max-w-4xl mx-auto list-disc list-inside space-y-2 text-slate-300 leading-relaxed">
        <li>
          Prioritize investments in AI data centers that demonstrate exceptional computational capacity and scalability.
        </li>
        <li>
          Focus on sustainability by supporting data centers using renewable energy and advanced cooling technologies.
        </li>
        <li>
          Foster long-term partnerships with AI hardware manufacturers and cloud service providers.
        </li>
        <li>Leverage data analytics to continuously assess and optimize portfolio performance.</li>
      </ul>
    </section>
  );
};

export default InvestmentPhilosophySection;
