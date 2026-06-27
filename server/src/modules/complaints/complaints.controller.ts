import { Request, Response } from 'express';
import { sendCreated } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { createComplaintSchema } from './complaints.validators';
import { Actor, createComplaint } from './complaints.service';

function getActor(req: Request): Actor {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return { id: req.user.id, role: req.user.role };
}

// POST /api/complaints
export async function create(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = createComplaintSchema.parse(req.body ?? {});
  const complaint = await createComplaint(actor, input);
  sendCreated(res, { complaint }, 'Complaint submitted');
}
