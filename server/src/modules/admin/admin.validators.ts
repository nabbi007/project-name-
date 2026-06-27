import { z } from 'zod';
import { UserRole, UserStatus, AiApiType, ProcessingStatus } from '@prisma/client';

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const listAiRunsQuerySchema = z.object({
  apiType: z.nativeEnum(AiApiType).optional(),
  processingStatus: z.nativeEnum(ProcessingStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const moderateListingSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(500).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ListAiRunsQuery = z.infer<typeof listAiRunsQuerySchema>;
export type ModerateListingInput = z.infer<typeof moderateListingSchema>;
