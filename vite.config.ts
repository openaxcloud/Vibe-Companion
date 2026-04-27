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
          if (!id.includes("node_modules")) return undefined;
          // Monaco Editor is ~2 MB on its own — isolate so other chunks
          // aren't blocked by it and browsers can cache it independently.
          if (id.includes("monaco-editor")) return "vendor-monaco";
          // Framer Motion pulls in a large animation runtime.
          if (id.includes("framer-motion")) return "vendor-motion";
          // Radix UI primitives are stable; split so they can be cached
          // across deploys that don't touch the design system.
          if (id.includes("@radix-ui")) return "vendor-radix";
          // TanStack Query + devtools
          if (id.includes("@tanstack")) return "vendor-tanstack";
          // React core — smallest chunk, almost never changes
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-is/") || id.includes("/scheduler/")) return "vendor-react";
          // Yjs collaboration stack
          if (id.includes("/yjs/") || id.includes("y-protocols") || id.includes("y-codemirror") || id.includes("lib0")) return "vendor-yjs";
          // All remaining third-party modules
          return "vendor";
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
  },
});
