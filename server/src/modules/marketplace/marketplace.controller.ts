import { Request, Response } from 'express';
import { sendPaginated, sendSuccess } from '../../utils/apiResponse';
import { browseQuerySchema } from './marketplace.validators';
import {
  browseListings,
  getPublicFarmer,
  getPublicListing,
} from './marketplace.service';

const param = (req: Request, key: string): string => String(req.params[key]);

// GET /api/marketplace/listings  (public)
export async function browse(req: Request, res: Response): Promise<void> {
  const query = browseQuerySchema.parse(req.query);
  const { listings, pagination } = await browseListings(query);
  sendPaginated(res, listings as unknown[], pagination);
}

// GET /api/marketplace/listings/:listingId  (public)
export async function detail(req: Request, res: Response): Promise<void> {
  const listing = await getPublicListing(param(req, 'listingId'));
  sendSuccess(res, { listing }, 'Listing retrieved');
}

// GET /api/marketplace/farmers/:farmerId  (public)
export async function farmerProfile(req: Request, res: Response): Promise<void> {
  const result = await getPublicFarmer(param(req, 'farmerId'));
  sendSuccess(res, result, 'Farmer profile retrieved');
}
