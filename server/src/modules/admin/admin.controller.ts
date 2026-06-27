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
import { listComplaints, updateComplaint } from '../complaints/complaints.service';
import { retryAiRun } from './retry-ai-run.service';
import {
  listComplaintsQuerySchema,
  updateComplaintSchema,
} from '../complaints/complaints.validators';

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

// GET /api/admin/complaints
export async function complaints(req: Request, res: Response): Promise<void> {
  const query = listComplaintsQuerySchema.parse(req.query);
  const { complaints: rows, pagination } = await listComplaints(query);
  sendPaginated(res, rows as unknown[], pagination);
}

// PATCH /api/admin/complaints/:complaintId
export async function complaintUpdate(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  const input = updateComplaintSchema.parse(req.body);
  const complaint = await updateComplaint(req.user.id, param(req, 'complaintId'), input);
  sendSuccess(res, { complaint }, 'Complaint updated');
}

// POST /api/admin/ai-runs/:runId/retry
export async function aiRunRetry(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  const actor = { id: req.user.id, role: req.user.role };
  const run = await retryAiRun(actor, param(req, 'runId'));
  sendSuccess(res, { run }, 'AI run retried');
}
