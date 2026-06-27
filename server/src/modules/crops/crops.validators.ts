import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  description: z.string().trim().max(500).optional(),
  defaultUnit: z.string().trim().max(20).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
