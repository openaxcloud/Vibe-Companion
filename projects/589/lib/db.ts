import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (typeof window === "undefined") {
  if (!global.__PRISMA_CLIENT__) {
    global.__PRISMA_CLIENT__ = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  prisma = global.__PRISMA_CLIENT__;
} else {
  // In browser environments we generally shouldn't instantiate Prisma.
  // This fallback exists mainly to satisfy type requirements in isomorphic code,
  // but will throw if actually used at runtime in the browser.
  throw new Error("PrismaClient should not be instantiated in the browser.");
}

export { prisma };
export default prisma;