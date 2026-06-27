import { z } from 'zod';

export const browseQuerySchema = z
  .object({
    crop: z.string().trim().max(80).optional(),
    region: z.string().trim().max(80).optional(),
    community: z.string().trim().max(80).optional(),
    search: z.string().trim().max(120).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice,
    { message: 'minPrice cannot be greater than maxPrice', path: ['minPrice'] }
  );

export type BrowseQuery = z.infer<typeof browseQuerySchema>;
