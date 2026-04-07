/**
 * E-Code Platform Pricing Constants
 * Based on Replit's pricing model (2025)
 * 
 * Architecture: Hybrid Model
 * 1. Fixed monthly/yearly subscription
 * 2. Monthly credits included in plan
 * 3. Resource allowances (vCPUs, RAM, storage, bandwidth)
 * 4. Pay-as-you-go when credits exhausted
 * 
 * Flow: Usage → Deduct from allowance → Deduct from credits → Pay-as-you-go
 */

// ====================================
// METERED PRICING (Pay-as-you-go)
// ====================================

export const METERED_PRICES = {
  // Compute
  COMPUTE_BOOST_PER_HOUR: 0.36,           // $0.36/hour for enhanced compute
  VCPU_HOUR: 0.09,                        // Derived: $0.36/4 vCPUs = $0.09 per vCPU hour
  
  // Deployments
  AUTOSCALE_BASE_FEE: 1.00,               // $1/month base fee
  AUTOSCALE_COMPUTE_UNIT: 0.000001,       // $1 per million compute units
  SCHEDULED_BASE_FEE: 1.00,               // $1/month base fee
  SCHEDULED_PER_SECOND: 0.000061,         // ~$0.000061/second
  
  // Storage
  APP_STORAGE_PER_GB_MONTH: 0.03,         // $0.03/GB/month
  POSTGRES_STORAGE_PER_GB_MONTH: 1.50,    // $1.50/GB/month
  POSTGRES_COMPUTE_PER_HOUR: 0.16,        // $0.16/hour compute
  
  // Bandwidth
  OUTBOUND_DATA_PER_GB: 0.10,             // $0.10/GB beyond allowance
  
  // AI Agent (effort-based, varies by complexity)
  AI_AGENT_SIMPLE: 0.25,                  // Simple tasks
  AI_AGENT_MEDIUM: 1.00,                  // Medium complexity
  AI_AGENT_COMPLEX: 5.00,                 // Complex tasks
} as const;

// ====================================
// PLAN DEFINITIONS
// ====================================

export interface PlanDefinition {
  name: string;
  tier: 'free' | 'core' | 'teams' | 'enterprise';
  priceMonthly: number;
  priceYearly: number;
  creditsMonthly: number;           // Credits included per month
  allowances: {
    vcpus: number;
    ramGb: number;
    storageGb: number;
    bandwidthGb: number;
    developmentMinutes: number;     // -1 = unlimited
    publicApps: number;             // -1 = unlimited
    privateApps: number;            // -1 = unlimited
    collaborators: number;
  };
  features: string[];
}

export const PLANS: Record<string, PlanDefinition> = {
  STARTER: {
    name: 'Starter',
    tier: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    creditsMonthly: 3,                // $3 of credits
    allowances: {
      vcpus: 1,
      ramGb: 2,
      storageGb: 1,
      bandwidthGb: 1,
      developmentMinutes: 1200,       // 20 hours
      publicApps: 10,
      privateApps: 0,
      collaborators: 1,
    },
    features: [
      'Replit Agent trial included',
      '10 development apps (with temporary links)',
      'Public apps only',
      'Limited build time, without long full autonomy',
    ],
  },
  
  CORE: {
    name: 'Core',
    tier: 'core',
    priceMonthly: 25,
    priceYearly: 20,                  // $20/month billed annually
    creditsMonthly: 25,               // $25 of credits
    allowances: {
      vcpus: 4,
      ramGb: 8,
      storageGb: 50,
      bandwidthGb: 100,
      developmentMinutes: -1,         // Unlimited
      publicApps: -1,
      privateApps: -1,
      collaborators: 3,
    },
    features: [
      'Full Replit Agent access',
      '$25 of monthly credits',
      'Private and public apps',
      'Access to latest models',
      'Publish and host live apps',
      'Pay-as-you-go for additional usage',
      'Autonomous long builds',
    ],
  },
  
  TEAMS: {
    name: 'Teams',
    tier: 'teams',
    priceMonthly: 40,
    priceYearly: 35,                  // $35/user/month billed annually
    creditsMonthly: 40,               // $40/month in usage credits
    allowances: {
      vcpus: 8,
      ramGb: 16,
      storageGb: 256,
      bandwidthGb: 1000,
      developmentMinutes: -1,
      publicApps: -1,
      privateApps: -1,
      collaborators: -1,              // All team members
    },
    features: [
      'Everything included with Replit Core',
      '$40/mo in usage credits included',
      'Credits granted upfront on annual plan',
      '50 Viewer seats',
      'Centralized billing',
      'Role-based access control',
      'Private deployments',
      'Pay-as-you-go for additional usage',
    ],
  },
  
  ENTERPRISE: {
    name: 'Enterprise',
    tier: 'enterprise',
    priceMonthly: 200,                // Custom pricing, baseline estimate
    priceYearly: 200,
    creditsMonthly: 100,              // Generous credits for enterprise
    allowances: {
      vcpus: 64,
      ramGb: 128,
      storageGb: 256,                 // 256GB+ custom
      bandwidthGb: 10000,             // Custom limits
      developmentMinutes: -1,
      publicApps: -1,
      privateApps: -1,
      collaborators: -1,
    },
    features: [
      'Everything in Teams',
      'Custom Viewer Seats',
      'SSO/SAML',
      'SCIM',
      'Advanced privacy controls',
      'Custom pricing',
      'Dedicated support',
    ],
  },
};

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Calculate cost for compute usage
 */
export function calculateComputeCost(vcpuHours: number): number {
  return vcpuHours * METERED_PRICES.VCPU_HOUR;
}

/**
 * Calculate cost for storage usage
 */
export function calculateStorageCost(storageGb: number, durationHours: number = 730): number {
  const monthlyEquivalent = (storageGb * durationHours) / 730; // 730 hours ≈ 1 month
  return monthlyEquivalent * METERED_PRICES.APP_STORAGE_PER_GB_MONTH;
}

/**
 * Calculate cost for bandwidth usage
 */
export function calculateBandwidthCost(bandwidthGb: number): number {
  return bandwidthGb * METERED_PRICES.OUTBOUND_DATA_PER_GB;
}

/**
 * Calculate cost for PostgreSQL usage
 */
export function calculatePostgresCost(
  storageGb: number, 
  computeHours: number
): number {
  const storageCost = storageGb * METERED_PRICES.POSTGRES_STORAGE_PER_GB_MONTH;
  const computeCost = computeHours * METERED_PRICES.POSTGRES_COMPUTE_PER_HOUR;
  return storageCost + computeCost;
}

/**
 * Get plan by tier
 */
export function getPlanByTier(tier: 'free' | 'core' | 'teams' | 'enterprise'): PlanDefinition {
  const planKey = tier.toUpperCase();
  return PLANS[planKey] || PLANS.STARTER;
}

/**
 * Check if usage exceeds allowance
 */
export function exceedsAllowance(
  usage: number,
  allowance: number
): { exceeds: boolean; overage: number } {
  if (allowance === -1) {
    return { exceeds: false, overage: 0 }; // Unlimited
  }
  
  const overage = Math.max(0, usage - allowance);
  return {
    exceeds: overage > 0,
    overage,
  };
}
