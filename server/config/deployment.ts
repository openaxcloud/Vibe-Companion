// Deployment configuration for Cloud Run optimization
export const deploymentConfig = {
  // Port configuration for Cloud Run
  port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
  
  // Host configuration for container environments
  host: process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost',
  
  // Bundle optimization settings
  bundleOptimization: {
    // Enable production optimizations
    minify: process.env.NODE_ENV === 'production',
    
    // Code splitting configuration
    chunks: {
      vendor: ['react', 'react-dom'],
      ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
      utils: ['clsx', 'date-fns', 'uuid']
    },
    
    // Size limits for chunks
    chunkSizeWarning: 500, // KB
    
    // Compression settings
    compression: {
      enabled: process.env.NODE_ENV === 'production',
      algorithm: 'gzip',
      level: 6
    }
  },
  
  // Security settings for production
  security: {
    // Disable eval in production
    allowEval: process.env.NODE_ENV !== 'production',
    
    // Content Security Policy
    csp: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", "data:", "https:"],
        'font-src': ["'self'", "https:"]
      }
    }
  },
  
  // Performance monitoring
  monitoring: {
    enabled: process.env.NODE_ENV === 'production',
    healthCheck: {
      path: '/api/monitoring/health',
      interval: 30000 // 30 seconds
    }
  }
};

export default deploymentConfig;