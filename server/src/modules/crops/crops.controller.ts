import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import { createCategorySchema } from './crops.validators';
import { createCategory, listCategories } from './crops.service';

// GET /api/crop-categories  (public)
export async function list(_req: Request, res: Response): Promise<void> {
  const categories = await listCategories();
  sendSuccess(res, { categories }, 'Crop categories retrieved');
}

// POST /api/crop-categories  (ADMIN)
export async function create(req: Request, res: Response): Promise<void> {
  const input = createCategorySchema.parse(req.body);
  const category = await createCategory(input);
  sendCreated(res, { category }, 'Crop category created');
}
