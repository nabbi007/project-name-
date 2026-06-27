import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { imageRelativePath } from '../../middleware/upload.middleware';
import { uploadImageSchema, reviewImageSchema } from './images.validators';
import {
  Actor,
  analyseImage,
  reviewImage,
  uploadImage,
} from './images.service';

function getActor(req: Request): Actor {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  return { id: req.user.id, role: req.user.role };
}

const param = (req: Request, key: string): string => String(req.params[key]);

// POST /api/listings/:listingId/images
export async function upload(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  if (!req.file) {
    throw AppError.badRequest('An image file is required', 'NO_IMAGE');
  }
  const { isPrimary } = uploadImageSchema.parse(req.body ?? {});
  const image = await uploadImage(
    actor,
    param(req, 'listingId'),
    imageRelativePath(req.file.filename),
    isPrimary
  );
  sendCreated(res, { image }, 'Image uploaded');
}

// POST /api/listing-images/:imageId/analyse
export async function analyse(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const result = await analyseImage(actor, param(req, 'imageId'));
  sendSuccess(res, result, 'Image analysed');
}

// POST /api/listing-images/:imageId/retry
export async function retry(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const result = await analyseImage(actor, param(req, 'imageId'));
  sendSuccess(res, result, 'Image analysis retried');
}

// PATCH /api/listing-images/:imageId/review
export async function review(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = reviewImageSchema.parse(req.body);
  const image = await reviewImage(actor, param(req, 'imageId'), input);
  sendSuccess(res, { image }, 'Image review saved');
}
