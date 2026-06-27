import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { transcribeAudioBuffer } from '../../services/snwolley/speech-to-text.service';
import {
  displayTranscript,
  localizeTranscript,
} from '../../services/snwolley/transcript-localization.service';
import { extractFromTranscriptLocally } from './transcript-extract.util';
import { listingIncompleteFields } from './missing-field-prompts';
import { extractSupplementViaAgent } from '../../services/snwolley/supplement-extract.service';
import { updateListing, type Actor } from './listings.service';
import type { UpdateListingInput } from './listings.validators';

export async function supplementListingFromVoice(
  actor: Actor,
  listingUuid: string,
  buffer: Buffer,
  filename: string,
  language?: string
) {
  const listing = await prisma.produceListing.findFirst({
    where: {
      uuid: listingUuid,
      ...(actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id }),
    },
    select: {
      uuid: true,
      title: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      availableDate: true,
      expiresAt: true,
      cropCategoryId: true,
      description: true,
    },
  });
  if (!listing) throw AppError.notFound('Listing not found');

  const missingBefore = listingIncompleteFields(listing);

  const stt = await transcribeAudioBuffer(buffer, filename, language);
  const localized = await localizeTranscript(stt.transcript, language);
  const englishTranscript = displayTranscript(localized);
  let { extracted } = extractFromTranscriptLocally(englishTranscript);

  if (missingBefore.length > 0) {
    const agentExtracted = await extractSupplementViaAgent(
      englishTranscript,
      localized.transcript,
      language,
      missingBefore
    );
    if (agentExtracted) {
      extracted = {
        ...extracted,
        crop: extracted.crop ?? agentExtracted.crop,
        quantity: extracted.quantity ?? agentExtracted.quantity,
        unit: extracted.unit ?? agentExtracted.unit,
        pricePerUnit: extracted.pricePerUnit ?? agentExtracted.pricePerUnit,
        availableDate: extracted.availableDate ?? agentExtracted.availableDate,
        expiryDate: extracted.expiryDate ?? agentExtracted.expiryDate,
        description: extracted.description ?? agentExtracted.description,
      };
    }
  }

  const patch: UpdateListingInput = {};

  const currentQty = Number(listing.quantity);
  if (
    extracted.quantity !== null &&
    extracted.quantity > 0 &&
    (!Number.isFinite(currentQty) || currentQty <= 0)
  ) {
    patch.quantity = extracted.quantity;
  }

  if (extracted.unit && !listing.unit) {
    patch.unit = extracted.unit;
  }

  const currentPrice = Number(listing.pricePerUnit);
  if (
    extracted.pricePerUnit !== null &&
    extracted.pricePerUnit > 0 &&
    (!Number.isFinite(currentPrice) || currentPrice <= 0)
  ) {
    patch.pricePerUnit = extracted.pricePerUnit;
  }

  if (extracted.availableDate && !listing.availableDate) {
    patch.availableDate = new Date(extracted.availableDate);
  }

  if (extracted.expiryDate && !listing.expiresAt) {
    patch.expiresAt = new Date(extracted.expiryDate);
  }

  if (extracted.crop) {
    const title = (listing.title ?? '').trim();
    const titleBad =
      !title || /^\d/.test(title) || /pricing/i.test(title) || title.split(/\s+/).length > 5;
    if (titleBad || !listing.cropCategoryId) {
      const bits = [
        extracted.quantity ?? patch.quantity,
        extracted.unit ?? patch.unit,
        extracted.crop,
      ].filter(Boolean);
      patch.title = bits.length ? bits.join(' ') : extracted.crop;
    }

    if (!listing.cropCategoryId) {
      const category = await prisma.cropCategory.findFirst({
        where: {
          OR: [
            { name: { equals: extracted.crop, mode: 'insensitive' } },
            { slug: { equals: extracted.crop.toLowerCase(), mode: 'insensitive' } },
          ],
        },
        select: { uuid: true },
      });
      if (category) patch.cropCategoryId = category.uuid;
    }
  }

  const desc = [listing.description, englishTranscript].filter(Boolean).join(' ').trim();
  if (desc) patch.description = desc;

  if (Object.keys(patch).length === 0) {
    throw AppError.badRequest(
      'Could not read the missing details from that recording. Try again or type them in the form.',
      'SUPPLEMENT_EMPTY'
    );
  }

  const updated = await updateListing(actor, listingUuid, patch);

  const incompleteFields = listingIncompleteFields({
    title: updated.title,
    quantity: updated.quantity,
    unit: updated.unit,
    pricePerUnit: updated.pricePerUnit,
    availableDate: updated.availableDate,
  });

  return {
    listing: updated,
    transcript: englishTranscript,
    originalTranscript: localized.translated ? localized.transcript : undefined,
    filledFields: Object.keys(patch),
    incompleteFields,
  };
}
