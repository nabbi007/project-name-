import { z } from 'zod';
import { ListingStatus } from '@prisma/client';
import { SUPPORTED_UNITS } from './listing.constants';

const unitSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => (SUPPORTED_UNITS as readonly string[]).includes(v), {
    message: `Unit must be one of: ${SUPPORTED_UNITS.join(', ')}`,
  });

export const createListingSchema = z.object({
  farmerId: z.string().uuid('A valid farmer id is required'),
  cropCategoryId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: unitSchema.optional(),
  pricePerUnit: z.coerce.number().positive().optional(),
  availableDate: z.coerce.date().optional(),
  region: z.string().trim().max(80).optional(),
  community: z.string().trim().max(80).optional(),
});

export const updateListingSchema = z.object({
  cropCategoryId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: unitSchema.optional(),
  pricePerUnit: z.coerce.number().positive().optional(),
  availableDate: z.coerce.date().optional(),
  region: z.string().trim().max(80).optional(),
  community: z.string().trim().max(80).optional(),
  agentConfirmed: z.boolean().optional(),
});

export const listListingsQuerySchema = z.object({
  status: z.nativeEnum(ListingStatus).optional(),
  cropCategoryId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListListingsQuery = z.infer<typeof listListingsQuerySchema>;
