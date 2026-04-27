import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

function buildTimestampPlugin(): Plugin {
  return {
    name: 'build-timestamp',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { name: 'build-time', content: new Date().toISOString() },
          injectTo: 'head',
        },
      ];
    },
  };
}

export default defineConfig({
  // Pre-bundle heavy dependencies that Vite would otherwise discover and
  // transform on-the-fly during the first cold load, causing the 30–40 s
  // delay observed in the 2026-04-27 audit.  Listing them here makes the
  // dev server run esbuild over them once at startup and serve pre-bundled
  // ESM from the cache — subsequent cold loads hit the cache instantly.
  optimizeDeps: {
    include: [
      // Core React stack — tiny but must be ready before anything else
      'react', 'react-dom', 'react-dom/client',
      // TanStack Query (large, many internal modules)
      '@tanstack/react-query',
      // Framer Motion (complex tree, slow to transform on first request)
      'framer-motion',
      // Yjs collaboration stack (multiple ESM sub-packages)
      'yjs', 'y-protocols/awareness', 'y-protocols/sync', 'lib0/observable',
      // Monaco uses a non-standard ESM layout that confuses Vite's scanner
      'monaco-editor/esm/vs/editor/editor.api',
    ],
    esbuildOptions: {
      // Match the target used for the production build
      target: 'es2020',
    },
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    buildTimestampPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: true,
    manifest: true,
    minify: 'esbuild',
    rollupOptions: {
      external: ['@sentry/react', '@sentry/browser'],
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  esbuild: {
    minifyIdentifiers: false,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Warm up the IDE entry point so the first request to /project/:id
    // does not trigger a cold-transform cascade on the main thread.
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/pages/UnifiedIDELayout.tsx',
        './src/components/editor/ReplitMonacoEditor.tsx',
        './src/components/ai/ReplitAgentPanelV3.tsx',
        './src/hooks/use-ide-workspace.ts',
      ],
    },
  },
});
