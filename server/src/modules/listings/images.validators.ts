import { z } from 'zod';
import { CropMatchStatus } from '@prisma/client';

// Multipart text fields accept strings; coerce "true"/"false" for isPrimary.
export const uploadImageSchema = z.object({
  isPrimary: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export const reviewImageSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  cropMatchStatus: z.nativeEnum(CropMatchStatus).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type ReviewImageInput = z.infer<typeof reviewImageSchema>;
