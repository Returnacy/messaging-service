import { prisma } from './prismaClient.js';

async function main() {
  // Idempotent upsert example for providers
  await prisma.provider.upsert({
    where: { id: '63ffbe66-9a6e-4749-bdb5-56f0c753b45d' },
    update: { name: 'resend', channel: 'EMAIL', credentialRef: 'secret-ref' },
    create: {
      id: '63ffbe66-9a6e-4749-bdb5-56f0c753b45d',
      name: 'resend',
      channel: 'EMAIL',
      credentialRef: 'secret-ref'
    }
  });

  console.log('Messaging DB seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
