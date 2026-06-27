import { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  createFarmerSchema,
  listFarmersQuerySchema,
  updateFarmerSchema,
  updateFarmerStatusSchema,
} from './farmers.validators';
import {
  Actor,
  createFarmer,
  getFarmer,
  listFarmers,
  updateFarmer,
  updateFarmerStatus,
} from './farmers.service';

function getActor(req: Request): Actor {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  return { id: req.user.id, role: req.user.role };
}

function getFarmerId(req: Request): string {
  return String(req.params.farmerId);
}

// POST /api/farmers  (FIELD_AGENT)
export async function create(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = createFarmerSchema.parse(req.body);
  const farmer = await createFarmer(actor, input);
  sendCreated(res, { farmer }, 'Farmer registered successfully');
}

// GET /api/farmers  (FIELD_AGENT own, ADMIN all)
export async function list(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = listFarmersQuerySchema.parse(req.query);
  const { farmers, pagination } = await listFarmers(actor, query);
  sendPaginated(res, farmers as unknown[], pagination);
}

// GET /api/farmers/:farmerId
export async function detail(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const farmer = await getFarmer(actor, getFarmerId(req));
  sendSuccess(res, { farmer }, 'Farmer retrieved');
}

// PATCH /api/farmers/:farmerId
export async function update(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = updateFarmerSchema.parse(req.body);
  const farmer = await updateFarmer(actor, getFarmerId(req), input);
  sendSuccess(res, { farmer }, 'Farmer updated');
}

// PATCH /api/farmers/:farmerId/status
export async function changeStatus(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = updateFarmerStatusSchema.parse(req.body);
  const farmer = await updateFarmerStatus(actor, getFarmerId(req), input);
  sendSuccess(res, { farmer }, 'Farmer status updated');
}
