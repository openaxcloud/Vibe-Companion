# Initialize a new React project with Vite
cd ..
mkdir frontend
cd frontend
npm create vite@latest my-ecommerce --template react-ts

# Navigate into the project
cd my-ecommerce

# Install frontend dependencies
npm install tailwindcss postcss autoprefixer tanstack/react-query wouter

# Initialize Tailwind CSS
npx tailwindcss init -p

# Create necessary directories and files
mkdir src/components src/pages src/hooks src/context
touch src/components/Navbar.tsx src/components/Footer.tsx src/components/ProductList.tsx
touch src/pages/Home.tsx src/pages/ProductDetails.tsx src/pages/Checkout.tsx