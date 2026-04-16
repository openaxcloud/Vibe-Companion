# E-commerce Marketplace

This is a full-stack e-commerce marketplace application with the following features:
- Product catalog with search and filters
- Shopping cart with checkout flow
- User authentication
- Stripe payments integration
- Order management dashboard
- Inventory tracking
- Email notifications for orders
- Mobile-responsive design with dark mode

## Project Structure

- `client/`: Frontend application built with React, Vite, and TypeScript.
- `server/`: Backend API built with Node.js, Express, and TypeScript.

## Setup

1.  **Environment Variables**: Create a `.env` file in the root directory based on `.env.example` and fill in your details.
2.  **Install Dependencies**: Run `npm install` in the root directory to install dependencies for both client and server.
3.  **Database**: Set up your PostgreSQL database and update `DATABASE_URL` in your `.env` file.
4.  **Run Migrations/Schema Sync**: (Future step, will be added to server setup)
5.  **Start Development Servers**: Run `npm run dev` to start both the client and server development servers.

## Client (Frontend)

-   **Framework**: React.js
-   **Build Tool**: Vite
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS
-   **Routing**: React Router DOM

## Server (Backend)

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Language**: TypeScript
-   **Database**: PostgreSQL
-   **Authentication**: JWT
-   **Payments**: Stripe
-   **Email**: Nodemailer
