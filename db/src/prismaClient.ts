import { PrismaClient } from "@prisma/client";

// Validate DATABASE_URL before initializing Prisma
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
  console.error('The messaging-service scheduler requires a valid DATABASE_URL to connect to PostgreSQL.');
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// Configure Prisma logging to reduce noise by default.
// Enable granular logs via env:
//   PRISMA_LOG_QUERY=true to include SQL queries
//   PRISMA_LOG_INFO=true to include informational logs
const prismaLogs: Array<'query' | 'info' | 'warn' | 'error'> = ['warn', 'error'];
if (process.env.PRISMA_LOG_INFO === 'true') prismaLogs.push('info');
if (process.env.PRISMA_LOG_QUERY === 'true') prismaLogs.push('query');

export const prisma = new PrismaClient({
  log: prismaLogs,
});

const gracefulShutdown = async () => {
  try {
    await prisma.$disconnect();
  } catch (e) {
    // log if you want
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);