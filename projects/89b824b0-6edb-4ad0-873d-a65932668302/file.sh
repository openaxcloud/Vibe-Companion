# Initialize a new Node.js project
mkdir backend
cd backend
npm init -y

# Install dependencies
npm install express typescript ts-node @types/node @types/express dotenv pg drizzle-orm passport passport-local bcryptjs connect-pg-simple express-session stripe sendgrid/mail

# Setup TypeScript configuration
npx tsc --init

# Create necessary directories and files
mkdir src
touch src/index.ts src/routes.ts src/models.ts src/controllers.ts src/middleware.ts