import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function upsertUser(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}): Promise<void> {
  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      phone: params.phone,
      role: params.role,
      status: UserStatus.ACTIVE,
    },
    create: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      passwordHash,
      role: params.role,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`Seeded ${params.role}: ${params.email}`);
}

async function main(): Promise<void> {
  await upsertUser({
    name: 'AgroVoice Admin',
    email: 'admin@agrovoice.test',
    phone: '+233200000000',
    password: 'Admin123!',
    role: UserRole.ADMIN,
  });

  await upsertUser({
    name: 'Test Field Agent',
    email: 'agent@agrovoice.test',
    phone: '+233200000001',
    password: 'Agent123!',
    role: UserRole.FIELD_AGENT,
  });

  await upsertUser({
    name: 'Test Buyer',
    email: 'buyer@agrovoice.test',
    phone: '+233200000002',
    password: 'Buyer123!',
    role: UserRole.BUYER,
  });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
