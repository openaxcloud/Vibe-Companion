/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      backgroundImage: {
        noise: "url('data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' fill=\'none\'%3e%3cpath stroke=\'%2331536a\' stroke-opacity=\'0.05\' stroke-width=\'1\' d=\'M0 100L100 0M-10 10l20-20M90 110l20-20\'/%3e%3c/svg%3e')",
      },
      colors: {
        indigo: {
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        violet: {
          600: "#7c3aed"
        },
        emerald: {
          500: "#10b981"
        }
      },
      boxShadow: {
        glow: "0 0 15px 4px rgba(99, 102, 241, 0.25)"
      }
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
