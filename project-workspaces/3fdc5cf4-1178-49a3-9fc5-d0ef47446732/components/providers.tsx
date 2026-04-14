'use client'

import { SessionProvider } from 'next-auth/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Elements stripe={stripePromise}>
        {children}
      </Elements>
    </SessionProvider>
  )
}