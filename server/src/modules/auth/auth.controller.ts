import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  registerSchema,
  loginSchema,
  createAgentSchema,
} from './auth.validators';
import {
  registerBuyer,
  login as loginService,
  getUserByUuid,
  createFieldAgent,
} from './auth.service';

// POST /api/auth/register  (public, BUYER only)
export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const { user, token } = await registerBuyer(input);
  sendCreated(res, { user, token }, 'Registration successful');
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const { user, token } = await loginService(input);
  sendSuccess(res, { user, token }, 'Login successful');
}

// GET /api/auth/me  (authenticated)
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  const user = await getUserByUuid(req.user.uuid);
  sendSuccess(res, { user }, 'Current user retrieved');
}

// POST /api/auth/logout
// JWTs are stateless; the client discards the token. We respond with success
// so the frontend has a consistent contract.
export async function logout(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, null, 'Logged out successfully');
}

// POST /api/admin/agents  (ADMIN only)
export async function createAgent(req: Request, res: Response): Promise<void> {
  const input = createAgentSchema.parse(req.body);
  const agent = await createFieldAgent(input);
  sendCreated(res, { agent }, 'Field agent created successfully');
}
