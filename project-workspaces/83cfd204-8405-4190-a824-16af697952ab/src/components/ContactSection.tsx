import React, { useState } from 'react';

const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setTimeout(() => {
      // Simulate success response
      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
    }, 2000);
  };

  return (
    <section id="contact" className="max-w-4xl mx-auto my-16 px-4">
      <h2 className="text-3xl font-bold mb-6 text-center">Contact Us</h2>
      <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-8 max-w-xl mx-auto">
        <div className="mb-4">
          <label htmlFor="name" className="block mb-1 font-semibold">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full rounded-md bg-white/10 border border-white/20 px-4 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="email" className="block mb-1 font-semibold">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full rounded-md bg-white/10 border border-white/20 px-4 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="message" className="block mb-1 font-semibold">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            value={formData.message}
            onChange={handleChange}
            className="w-full rounded-md bg-white/10 border border-white/20 px-4 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full bg-primary-600 hover:bg-primary-700 active:scale-95 transition rounded-lg px-6 py-3 font-semibold text-white shadow-glow"
        >
          {status === 'sending' ? 'Sending...' : 'Send Message'}
        </button>
        {status === 'success' && (
          <p className="mt-4 text-green-400 text-center">Thank you for your message. We'll get back to you soon.</p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-red-400 text-center">An error occurred. Please try again later.</p>
        )}
      </form>
    </section>
  );
};

export default ContactSection;
