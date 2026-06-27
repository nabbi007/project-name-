import { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  updateStatusSchema,
} from './orders.validators';
import {
  Actor,
  cancelOrder,
  createOrder,
  getOrder,
  listManagedOrders,
  listMyOrders,
  updateStatus,
} from './orders.service';

function getActor(req: Request): Actor {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return { id: req.user.id, role: req.user.role };
}

const param = (req: Request, key: string): string => String(req.params[key]);

// POST /api/orders  (BUYER)
export async function create(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = createOrderSchema.parse(req.body);
  const order = await createOrder(actor, input);
  sendCreated(res, { order }, 'Order placed');
}

// GET /api/orders/mine  (BUYER)
export async function listMine(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = listOrdersQuerySchema.parse(req.query);
  const { orders, pagination } = await listMyOrders(actor, query);
  sendPaginated(res, orders as unknown[], pagination);
}

// GET /api/orders  (FIELD_AGENT/ADMIN)
export async function listManaged(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = listOrdersQuerySchema.parse(req.query);
  const { orders, pagination } = await listManagedOrders(actor, query);
  sendPaginated(res, orders as unknown[], pagination);
}

// GET /api/orders/:orderId
export async function detail(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const order = await getOrder(actor, param(req, 'orderId'));
  sendSuccess(res, { order }, 'Order retrieved');
}

// PATCH /api/orders/:orderId/cancel  (BUYER)
export async function cancel(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const order = await cancelOrder(actor, param(req, 'orderId'));
  sendSuccess(res, { order }, 'Order cancelled');
}

// PATCH /api/orders/:orderId/status  (FIELD_AGENT/ADMIN)
export async function changeStatus(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = updateStatusSchema.parse(req.body);
  const order = await updateStatus(actor, param(req, 'orderId'), input);
  sendSuccess(res, { order }, 'Order status updated');
}
