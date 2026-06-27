import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  generateListingAudioSchema,
  generateOrderAudioSchema,
} from './audio.validators';
import {
  Actor,
  generateForListing,
  generateFieldPrompt,
  generateForOrder,
  getAudio,
  markPlayed,
  markFarmerConfirmed,
} from './audio.service';

function getActor(req: Request): Actor {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return { id: req.user.id, role: req.user.role };
}

const param = (req: Request, key: string): string => String(req.params[key]);

// POST /api/listings/:listingId/audio
export async function generateListing(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { language, fields } = generateListingAudioSchema.parse(req.body ?? {});
  const audio =
    fields && fields.length > 0
      ? await generateFieldPrompt(actor, param(req, 'listingId'), fields, language)
      : await generateForListing(actor, param(req, 'listingId'), language);
  sendCreated(
    res,
    { audio },
    fields?.length ? 'Missing-field prompt audio generated' : 'Listing notification audio generated'
  );
}

// POST /api/orders/:orderId/audio
export async function generateOrder(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const { messageType, language } = generateOrderAudioSchema.parse(req.body);
  const audio = await generateForOrder(actor, param(req, 'orderId'), messageType, language);
  sendCreated(res, { audio }, 'Order notification audio generated');
}

// GET /api/generated-audio/:audioId
export async function detail(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const audio = await getAudio(actor, param(req, 'audioId'));
  sendSuccess(res, { audio }, 'Generated audio retrieved');
}

// PATCH /api/generated-audio/:audioId/played
export async function played(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const audio = await markPlayed(actor, param(req, 'audioId'));
  sendSuccess(res, { audio }, 'Audio marked as played');
}

// PATCH /api/generated-audio/:audioId/farmer-confirmed
export async function farmerConfirmed(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const audio = await markFarmerConfirmed(actor, param(req, 'audioId'));
  sendSuccess(res, { audio }, 'Farmer confirmation recorded');
}
