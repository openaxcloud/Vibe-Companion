/**
 * PostCSS configuration for Vite client bundle
 * Loads Tailwind CSS and Autoprefixer for processing main CSS.
 */

/** @type {import('postcss-load-config').Config} */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};