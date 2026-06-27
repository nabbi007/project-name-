import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { AppError } from '../../utils/AppError';
import { CreateAgentInput, LoginInput, RegisterInput } from './auth.validators';

// Fields safe to return to clients - passwordHash is always excluded.
const publicUserSelect = {
  id: true,
  uuid: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

async function createUser(
  input: RegisterInput | CreateAgentInput,
  role: UserRole
): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role,
      status: UserStatus.ACTIVE,
    },
    select: publicUserSelect,
  });
}

export async function registerBuyer(input: RegisterInput): Promise<{
  user: PublicUser;
  token: string;
}> {
  // Public registration is always a BUYER, regardless of any client input.
  const user = await createUser(input, UserRole.BUYER);
  const token = signToken({ sub: user.uuid, role: user.role });
  return { user, token };
}

export async function login(input: LoginInput): Promise<{
  user: PublicUser;
  token: string;
}> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Use a generic message so we don't reveal whether the email exists.
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordValid = await comparePassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw AppError.forbidden(
      'Your account has been suspended. Please contact an administrator.',
      'ACCOUNT_SUSPENDED'
    );
  }

  const token = signToken({ sub: user.uuid, role: user.role });

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { user: safeUser, token };
}

export async function getUserByUuid(uuid: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { uuid },
    select: publicUserSelect,
  });
  if (!user) {
    throw AppError.notFound('User not found');
  }
  return user;
}

export async function createFieldAgent(
  input: CreateAgentInput
): Promise<PublicUser> {
  return createUser(input, UserRole.FIELD_AGENT);
}
