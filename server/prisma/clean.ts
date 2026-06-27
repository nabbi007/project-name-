import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Wipes all application data (users, farmers, listings, orders, etc.). */
async function main(): Promise<void> {
  await prisma.aiProcessingRun.deleteMany();
  await prisma.generatedAudio.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.produceListing.deleteMany();
  await prisma.voiceResponse.deleteMany();
  await prisma.voiceSession.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.cropCategory.deleteMany();
  await prisma.user.deleteMany();

  console.log('Database cleared — all mock and dev data removed.');
}

main()
  .catch((error) => {
    console.error('Clean failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
