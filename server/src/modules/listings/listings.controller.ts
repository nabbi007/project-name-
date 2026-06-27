import { Request, Response } from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { Actor, extractListing } from './listing-extraction.service';
import {
  createListingSchema,
  listListingsQuerySchema,
  updateListingSchema,
} from './listings.validators';
import {
  createListing,
  getListing,
  listListings,
  publishListing,
  unpublishListing,
  updateListing,
} from './listings.service';
import { supplementListingFromVoice } from './listing-supplement.service';
import { supplementVoiceSchema } from '../audio/audio.validators';
import { audioExtension } from '../../middleware/upload.middleware';

function getActor(req: Request): Actor {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  return { id: req.user.id, role: req.user.role };
}

const param = (req: Request, key: string): string => String(req.params[key]);

// POST /api/voice-sessions/:sessionId/extract-listing
export async function extract(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const result = await extractListing(actor, String(req.params.sessionId));
  sendCreated(
    res,
    result,
    result.incompleteFields.length
      ? 'Draft listing created with fields needing review'
      : 'Draft listing created from voice session'
  );
}

// POST /api/listings
export async function create(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = createListingSchema.parse(req.body);
  const listing = await createListing(actor, input);
  sendCreated(res, { listing }, 'Draft listing created');
}

// GET /api/listings
export async function list(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const query = listListingsQuerySchema.parse(req.query);
  const { listings, pagination } = await listListings(actor, query);
  sendPaginated(res, listings as unknown[], pagination);
}

// GET /api/listings/:listingId
export async function detail(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const listing = await getListing(actor, param(req, 'listingId'));
  sendSuccess(res, { listing }, 'Listing retrieved');
}

// PATCH /api/listings/:listingId
export async function update(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = updateListingSchema.parse(req.body);
  const listing = await updateListing(actor, param(req, 'listingId'), input);
  sendSuccess(res, { listing }, 'Listing updated');
}

// POST /api/listings/:listingId/publish
export async function publish(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const listing = await publishListing(actor, param(req, 'listingId'));
  sendSuccess(res, { listing }, 'Listing published');
}

// POST /api/listings/:listingId/unpublish
export async function unpublish(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const listing = await unpublishListing(actor, param(req, 'listingId'));
  sendSuccess(res, { listing }, 'Listing unpublished');
}

// POST /api/listings/:listingId/supplement-voice  (multipart: audio + language?)
export async function supplementVoice(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = supplementVoiceSchema.parse(req.body ?? {});

  if (!req.file) {
    throw AppError.badRequest('An audio recording is required', 'NO_AUDIO');
  }

  const ext = audioExtension(req.file.mimetype);
  const filename = req.file.originalname?.endsWith(ext)
    ? req.file.originalname
    : `supplement${ext}`;

  const result = await supplementListingFromVoice(
    actor,
    param(req, 'listingId'),
    req.file.buffer,
    filename,
    input.language
  );

  sendSuccess(res, result, 'Listing updated from voice recording');
}
