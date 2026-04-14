'use client'

import { 
  Shield, 
  CreditCard, 
  Users, 
  BarChart3, 
  Mail, 
  FileText,
  Zap,
  Globe,
  Lock,
  Smartphone,
  Cloud,
  Headphones
} from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Shield,
    title: 'Authentication & Authorization',
    description: 'Secure user authentication with social login, JWT tokens, and role-based access control.',
    color: 'text-blue-600',
  },
  {
    icon: CreditCard,
    title: 'Stripe Billing Integration',
    description: 'Complete billing solution with subscriptions, usage-based pricing, and invoice management.',
    color: 'text-green-600',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Multi-tenant architecture with team invitations, role management, and collaboration tools.',
    color: 'text-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Real-time analytics with usage tracking, revenue metrics, and customer insights.',
    color: 'text-orange-600',
  },
  {
    icon: Mail,
    title: 'Email Automation',
    description: 'Automated email flows for onboarding, notifications, and transactional messages.',
    color: 'text-red-600',
  },
  {
    icon: FileText,
    title: 'API Documentation',
    description: 'Interactive API docs with authentication, rate limiting, and usage examples.',
    color: 'text-indigo-600',
  },
  {
    icon: Zap,
    title: 'Performance Optimized',
    description: 'Built with Next.js 14, optimized for speed with caching and code splitting.',
    color: 'text-yellow-600',
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'SOC 2 compliant with encryption at rest, GDPR compliance, and security headers.',
    color: 'text-gray-600',
  },
  {
    icon: Globe,
    title: 'Multi-language Support',
    description: 'Internationalization ready with RTL support and dynamic locale switching.',
    color: 'text-cyan-600',
  },
  {
    icon: Smartphone,
    title: 'Mobile Responsive',
    description: 'Fully responsive design that works perfectly on all devices and screen sizes.',
    color: 'text-pink-600',
  },
  {
    icon: Cloud,
    title: 'Cloud Infrastructure',
    description: 'Deploy anywhere with Docker support and integration with major cloud providers.',
    color: 'text-blue-500',
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    description: 'Comprehensive documentation, video tutorials, and community support.',
    color: 'text-emerald-600',
  },
]

export function Features() {
  return (
    <section id="features" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"
          >
            Everything You Need to Build a SaaS
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-xl text-gray-600 max-w-3xl mx-auto"
          >
            Skip the boilerplate and focus on your unique value proposition. 
            Our starter kit includes all the essential features you need.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow hover-lift"
              >
                <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* Feature highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center text-white"
        >
          <h3 className="text-2xl font-bold mb-4">
            Ready to Deploy in Minutes
          </h3>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Our starter kit comes with detailed documentation, deployment guides, 
            and video tutorials to get you up and running quickly.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Vercel', 'AWS', 'Google Cloud', 'Digital Ocean'].map((platform) => (
              <div key={platform} className="px-4 py-2 bg-white/20 rounded-lg text-sm">
                {platform}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}