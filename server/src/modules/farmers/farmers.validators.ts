import { z } from 'zod';
import { FarmerStatus } from '@prisma/client';

const optionalTrimmed = (max = 120) =>
  z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

export const createFarmerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  displayName: optionalTrimmed(80),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number is too short')
    .max(20, 'Phone number is too long')
    .optional(),
  gender: optionalTrimmed(20),
  preferredLanguage: optionalTrimmed(40),
  region: optionalTrimmed(80),
  district: optionalTrimmed(80),
  community: optionalTrimmed(80),
  notes: z.string().trim().max(1000).optional(),
  // When true, records the moment the farmer gave consent.
  consentConfirmed: z.boolean().optional(),
});

export const updateFarmerSchema = createFarmerSchema.partial();

export const updateFarmerStatusSchema = z.object({
  status: z.nativeEnum(FarmerStatus),
});

export const listFarmersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(FarmerStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateFarmerInput = z.infer<typeof createFarmerSchema>;
export type UpdateFarmerInput = z.infer<typeof updateFarmerSchema>;
export type UpdateFarmerStatusInput = z.infer<typeof updateFarmerStatusSchema>;
export type ListFarmersQuery = z.infer<typeof listFarmersQuerySchema>;
