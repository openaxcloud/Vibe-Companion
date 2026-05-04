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
          // Monaco editor is ~2 MB minified — isolate it so it can be cached
          // independently and loaded in parallel with the app shell.
          if (id.includes("monaco-editor")) return "monaco";
          // xterm bundles a WebGL renderer + addons — keep separate from Monaco
          // so neither blocks the other.
          if (id.includes("xterm")) return "xterm";
          // React core stays in its own chunk; a cache bust on tanstack or
          // lucide doesn't force a re-download of the framework.
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "react";
          // Heavy UI / data libraries that change together.
          if (id.includes("@tanstack") || id.includes("@radix-ui")) return "ui-vendors";
          // Icon set is large (all tree-shaken at build time but still ~300 kB).
          if (id.includes("lucide-react")) return "lucide";
          // Remaining third-party code.
          if (id.includes("node_modules")) return "vendor";
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
