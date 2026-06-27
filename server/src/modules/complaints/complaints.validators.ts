import { z } from 'zod';
import { ComplaintStatus } from '@prisma/client';

export const createComplaintSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  category: z.string().trim().min(1).max(80).default('GENERAL'),
  // Frontend sends "message"; accept either field name.
  description: z.string().trim().min(10).max(2000).optional(),
  message: z.string().trim().min(10).max(2000).optional(),
}).refine((d) => !!(d.description ?? d.message), {
  message: 'A description is required',
  path: ['description'],
});

export const listComplaintsQuerySchema = z.object({
  status: z.nativeEnum(ComplaintStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateComplaintSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
  resolution: z.string().trim().max(2000).optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type ListComplaintsQuery = z.infer<typeof listComplaintsQuerySchema>;
export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;
