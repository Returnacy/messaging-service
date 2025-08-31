import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
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