import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Idempotent upsert example for providers
  await prisma.provider.create({
    data: {
      id: "63ffbe66-9a6e-4749-bdb5-56f0c753b45d",
      name: "resend",
      channel: "EMAIL",
      credentialRef: "secret-ref"
    }
  });

  // add more upserts for data you need...
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());