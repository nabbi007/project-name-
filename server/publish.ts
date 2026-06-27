import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.produceListing.updateMany({
    where: { status: 'DRAFT' },
    data: { status: 'PUBLISHED', publishedAt: new Date() }
  });
  console.log('Updated listings:', result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
