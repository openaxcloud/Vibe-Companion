import React from 'react';

const testimonials = [
  {
    name: 'Sara K.',
    role: 'AI Researcher',
    company: 'Innovate AI Labs',
    testimonial:
      'Investing with AI Data Invest has given us access to unparalleled computing power and infrastructure support.',
    avatarUrl: 'https://randomuser.me/api/portraits/women/72.jpg',
  },
  {
    name: 'James M.',
    role: 'Cloud Architect',
    company: 'CloudNext',
    testimonial:
      'Their focus on sustainable AI data centers aligns perfectly with our company’s green technology goals.',
    avatarUrl: 'https://randomuser.me/api/portraits/men/45.jpg',
  },
  {
    name: 'Emily R.',
    role: 'Data Scientist',
    company: 'DeepThink',
    testimonial:
      'Reliable and scalable infrastructure investment that drives AI innovation forward.',
    avatarUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
];

const TestimonialsSection: React.FC = () => {
  return (
    <section id="testimonials" className="max-w-5xl mx-auto my-16 px-4">
      <h2 className="text-3xl font-bold mb-10 text-center">What Our Clients Say</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {testimonials.map(({ name, role, company, testimonial, avatarUrl }) => (
          <div
            key={name}
            className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-xl shadow-glow hover:shadow-primary-500 transition cursor-pointer flex flex-col items-center text-center"
          >
            <img
              src={avatarUrl}
              alt={name}
              className="w-16 h-16 rounded-full mb-4 border-2 border-primary-500"
            />
            <p className="text-slate-300 italic mb-4">"{testimonial}"</p>
            <p className="font-semibold text-primary-400 mb-1">{name}</p>
            <p className="text-sm text-slate-400">
              {role} @ {company}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TestimonialsSection;
