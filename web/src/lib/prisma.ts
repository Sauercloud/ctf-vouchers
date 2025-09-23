import { PrismaClient } from "@/generated/prisma";

// Declare a global variable to hold the Prisma Client instance.
// This is necessary to avoid creating new connections on every hot reload in development.
declare global {
  var prisma: PrismaClient | undefined;
}

// Initialize the Prisma Client.
// If a global instance already exists, use it; otherwise, create a new one.
// In production, `globalThis.prisma` will be undefined, so a new client is always created.
// In development, the existing `globalThis.prisma` is reused across hot reloads.
export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : [],
  });

// If we are in a development environment, assign the Prisma Client instance
// to the global variable to persist it across hot reloads.
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

