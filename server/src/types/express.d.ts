import { UserRole, UserStatus } from '@prisma/client';

// The authenticated principal attached to the request by auth middleware.
export interface AuthUser {
  id: number;
  uuid: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
