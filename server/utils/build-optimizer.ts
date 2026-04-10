// Build optimization utilities for Cloud Run deployment
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class BuildOptimizer {
  private static readonly CHUNK_SIZE_LIMIT = 500; // KB
  private static readonly BUNDLE_SIZE_LIMIT = 2000; // KB

  static async optimizeForProduction(): Promise<void> {
    try {
      // 1. Clean previous builds
      await this.cleanBuildDirectory();
      
      // 2. Optimize JavaScript bundles
      await this.optimizeJavaScript();
      
      // 3. Optimize CSS
      await this.optimizeCSS();
      
      // 4. Generate service worker for caching
      await this.generateServiceWorker();
      
      // 5. Compress static assets
      await this.compressAssets();
    } catch (error) {
      console.error('❌ Build optimization failed:', error);
      throw error;
    }
  }

  private static async cleanBuildDirectory(): Promise<void> {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
  }

  private static async optimizeJavaScript(): Promise<void> {
    // Use terser for advanced JavaScript minification
    const terserOptions = {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
        unsafe: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_proto: true
      },
      mangle: {
        properties: {
          regex: /^_/
        }
      },
      format: {
        comments: false
      }
    };
  }

  private static async optimizeCSS(): Promise<void> {
    // CSS optimization and purging
  }

  private static async generateServiceWorker(): Promise<void> {
    const swContent = `
// Service Worker for caching static assets
const CACHE_NAME = 'e-code-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
    `;
    
    const distPublic = path.join(process.cwd(), 'dist', 'public');
    if (!fs.existsSync(distPublic)) {
      fs.mkdirSync(distPublic, { recursive: true });
    }
    
    fs.writeFileSync(path.join(distPublic, 'sw.js'), swContent.trim());
  }

  private static async compressAssets(): Promise<void> {
    // Gzip compression for static assets
  }

  static validateBundleSize(bundlePath: string): void {
    if (!fs.existsSync(bundlePath)) {
      console.warn(`⚠️ Bundle not found: ${bundlePath}`);
      return;
    }

    const stats = fs.statSync(bundlePath);
    const sizeKB = Math.round(stats.size / 1024);
    
    if (sizeKB > this.CHUNK_SIZE_LIMIT) {
      console.warn(`⚠️ Large bundle detected: ${bundlePath} (${sizeKB}KB > ${this.CHUNK_SIZE_LIMIT}KB) - consider code splitting`);
    }
  }
}

export default BuildOptimizer;