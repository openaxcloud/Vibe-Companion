import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export const getStripeCustomerByEmail = async (email: string) => {
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  })
  return customers.data[0]
}

export const createStripeCustomer = async (email: string, name?: string) => {
  return await stripe.customers.create({
    email,
    name,
  })
}

export const pricingPlans = {
  starter: {
    name: 'Starter',
    description: 'Perfect for individuals and small projects',
    price: 9,
    stripePriceId: 'price_starter',
    features: [
      '10,000 API calls/month',
      '1 GB storage',
      'Email support',
      'Basic analytics',
    ],
    limits: {
      apiCalls: 10000,
      storage: 1024, // MB
      teamMembers: 1,
    },
  },
  pro: {
    name: 'Pro',
    description: 'Great for growing businesses',
    price: 29,
    stripePriceId: 'price_pro',
    features: [
      '100,000 API calls/month',
      '10 GB storage',
      'Priority support',
      'Advanced analytics',
      'Team collaboration',
      'Custom integrations',
    ],
    limits: {
      apiCalls: 100000,
      storage: 10240, // MB
      teamMembers: 10,
    },
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price: 99,
    stripePriceId: 'price_enterprise',
    features: [
      'Unlimited API calls',
      '100 GB storage',
      '24/7 phone support',
      'Custom analytics',
      'Unlimited team members',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated account manager',
    ],
    limits: {
      apiCalls: -1, // unlimited
      storage: 102400, // MB
      teamMembers: -1, // unlimited
    },
  },
}

export const usagePricing = {
  apiCalls: {
    name: 'Additional API Calls',
    price: 0.001, // $0.001 per call
    unit: 'call',
    stripePriceId: 'price_api_calls',
  },
  storage: {
    name: 'Additional Storage',
    price: 0.1, // $0.10 per GB
    unit: 'GB',
    stripePriceId: 'price_storage',
  },
}