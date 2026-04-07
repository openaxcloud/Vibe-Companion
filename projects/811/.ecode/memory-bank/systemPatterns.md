# System Patterns – Memory Bank

## Architecture Overview
- Full‑stack TypeScript app with React frontend consuming a TypeScript backend API.
- Likely layered architecture on backend: API layer → service layer → data access layer.
- RESTful JSON APIs for core resources (products, cart, orders, auth, Stripe hooks).

## Key Domain Entities to Remember
- User (customer / admin flags), Product, Cart / CartItem, Order / OrderItem, PaymentIntent (Stripe), Session/Token.

## Core Patterns
- Authentication: JWT or session cookies with HTTP‑only cookies for security; protected routes on both client and server.
- State Management: client‑side state for cart and session (React + chosen state library) with server validation.
- Stripe Integration: server‑side creation of PaymentIntents; webhook handler to mark orders as paid/failed.
- Pagination & Filtering: query‑param based API (e.g., `/products?search=&category=&minPrice=&maxPrice=&sort=`).

## Error & Data Handling
- Centralized error handling middleware on backend; standardized error responses.
- Input validation at API boundaries (e.g., Zod/Yup) with typed DTOs.

## Security / Compliance to Keep Stable
- Never expose Stripe secret keys on frontend.
- Verify Stripe webhooks with signing secret.
- Use HTTPS assumptions and secure cookie settings for auth.