import { Request, Response } from 'express';
import { sendCreated } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { Actor, extractListing } from './listing-extraction.service';

function getActor(req: Request): Actor {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  return { id: req.user.id, role: req.user.role };
}

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
