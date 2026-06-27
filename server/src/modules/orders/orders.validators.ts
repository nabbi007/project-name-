import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const createOrderSchema = z.object({
  listingId: z.string().uuid('A valid listing id is required'),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  deliveryLocation: z.string().trim().max(200).optional(),
  paymentMethod: z
    .enum(['CASH_ON_DELIVERY', 'PAY_ON_PICKUP', 'SIMULATED_MOMO'])
    .default('PAY_ON_PICKUP'),
  notes: z.string().trim().max(500).optional(),
});

export const listOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Statuses an agent/admin may move an order to via the status endpoint.
export const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().trim().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
