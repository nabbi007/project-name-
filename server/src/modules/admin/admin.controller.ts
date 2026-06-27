import { Request, Response } from 'express';
import { sendPaginated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  listUsersQuerySchema,
  updateUserStatusSchema,
  listAiRunsQuerySchema,
  moderateListingSchema,
} from './admin.validators';
import {
  getDashboardStats,
  listUsers,
  updateUserStatus,
  listAiRuns,
  moderateListing,
} from './admin.service';

const param = (req: Request, key: string): string => String(req.params[key]);

// GET /api/admin/stats
export async function stats(_req: Request, res: Response): Promise<void> {
  const data = await getDashboardStats();
  sendSuccess(res, data, 'Dashboard statistics');
}

// GET /api/admin/users
export async function users(req: Request, res: Response): Promise<void> {
  const query = listUsersQuerySchema.parse(req.query);
  const { users: rows, pagination } = await listUsers(query);
  sendPaginated(res, rows as unknown[], pagination);
}

// PATCH /api/admin/users/:userId/status
export async function userStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  const input = updateUserStatusSchema.parse(req.body);
  const user = await updateUserStatus(req.user.id, param(req, 'userId'), input);
  sendSuccess(res, { user }, 'User status updated');
}

// GET /api/admin/ai-runs
export async function aiRuns(req: Request, res: Response): Promise<void> {
  const query = listAiRunsQuerySchema.parse(req.query);
  const { runs, pagination } = await listAiRuns(query);
  sendPaginated(res, runs as unknown[], pagination);
}

// PATCH /api/admin/listings/:listingId/moderate
export async function moderate(req: Request, res: Response): Promise<void> {
  const input = moderateListingSchema.parse(req.body);
  const listing = await moderateListing(param(req, 'listingId'), input);
  sendSuccess(res, { listing }, `Listing ${input.decision === 'APPROVE' ? 'approved' : 'rejected'}`);
}
