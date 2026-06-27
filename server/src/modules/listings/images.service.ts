import path from 'path';
import {
  Prisma,
  UserRole,
  ImageStatus,
  CropMatchStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { analyseImageFile } from '../../services/snwolley/vision.service';
import {
  structureObservation,
  computeCropMatch,
} from '../../services/snwolley/vision-structuring.service';
import { ReviewImageInput } from './images.validators';

export interface Actor {
  id: number;
  role: UserRole;
}

const CROP_ANALYSIS_PROMPT =
  'Analyse this crop image. Identify the crop, its dominant colours, maturity or ripeness, ' +
  'overall visible condition, and any visible issues such as bruising, mould, or damage. ' +
  'Base your answer ONLY on visible features in the image.';

const imageSelect = {
  uuid: true,
  imagePath: true,
  visionPrompt: true,
  visionResponse: true,
  cropMatchStatus: true,
  isPrimary: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ListingImageSelect;

function listingScope(actor: Actor): Prisma.ProduceListingWhereInput {
  return actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id };
}

async function resolveOwnedListing(actor: Actor, listingUuid: string) {
  const listing = await prisma.produceListing.findFirst({
    where: { uuid: listingUuid, ...listingScope(actor) },
    select: { id: true },
  });
  if (!listing) {
    throw AppError.notFound('Listing not found');
  }
  return listing;
}

export async function uploadImage(
  actor: Actor,
  listingUuid: string,
  imageRelPath: string,
  isPrimary: boolean
) {
  const listing = await resolveOwnedListing(actor, listingUuid);

  if (isPrimary) {
    await prisma.listingImage.updateMany({
      where: { produceListingId: listing.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return prisma.listingImage.create({
    data: {
      produceListingId: listing.id,
      imagePath: imageRelPath,
      isPrimary,
      status: ImageStatus.PENDING,
      cropMatchStatus: CropMatchStatus.MANUAL_REVIEW_REQUIRED,
    },
    select: imageSelect,
  });
}

// Loads an image enforcing ownership through its listing, plus the data needed
// for crop comparison.
async function resolveOwnedImage(actor: Actor, imageUuid: string) {
  const image = await prisma.listingImage.findFirst({
    where: {
      uuid: imageUuid,
      produceListing:
        actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id },
    },
    select: {
      id: true,
      imagePath: true,
      produceListingId: true,
      produceListing: {
        select: {
          id: true,
          title: true,
          cropCategory: { select: { name: true } },
        },
      },
    },
  });
  if (!image) {
    throw AppError.notFound('Listing image not found');
  }
  return image;
}

export async function analyseImage(actor: Actor, imageUuid: string) {
  const image = await resolveOwnedImage(actor, imageUuid);
  const expectedCrop = image.produceListing.cropCategory?.name ?? null;
  const absolutePath = path.join(process.cwd(), image.imagePath);

  const run = await prisma.aiProcessingRun.create({
    data: {
      processableType: 'ListingImage',
      processableId: image.id,
      apiType: 'VISION',
      requestSummary: `Vision for ${path.basename(image.imagePath)}`,
      processingStatus: 'PROCESSING',
      attempts: 1,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  try {
    const vision = await analyseImageFile(absolutePath, CROP_ANALYSIS_PROMPT);
    const { observation } = await structureObservation(
      vision.description,
      expectedCrop
    );
    const cropMatchStatus = computeCropMatch(
      expectedCrop,
      observation,
      vision.description
    );

    const observationJson = JSON.stringify(observation);

    const updated = await prisma.listingImage.update({
      where: { id: image.id },
      data: {
        visionPrompt: CROP_ANALYSIS_PROMPT,
        visionResponse: vision.description,
        cropMatchStatus,
        // Always require human review even on a MATCH.
        status: ImageStatus.ANALYSED,
      },
      select: imageSelect,
    });

    // Mirror observation onto the listing for convenience.
    await prisma.produceListing.update({
      where: { id: image.produceListing.id },
      data: {
        visionDescription: vision.description,
        visualObservation: observationJson,
      },
    });

    await prisma.aiProcessingRun.update({
      where: { id: run.id },
      data: {
        processingStatus: 'COMPLETED',
        responseContent: vision.description.slice(0, 2000),
        httpStatus: 200,
        completedAt: new Date(),
      },
    });

    return { image: updated, observation, cropMatchStatus };
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError('Vision analysis failed', 502, 'VISION_UNAVAILABLE');

    await prisma.listingImage.update({
      where: { id: image.id },
      data: { status: ImageStatus.PENDING },
    });

    await prisma.aiProcessingRun.update({
      where: { id: run.id },
      data: {
        processingStatus: 'FAILED',
        httpStatus: appErr.statusCode,
        errorMessage: appErr.message,
        completedAt: new Date(),
      },
    });

    throw appErr;
  }
}

export async function reviewImage(
  actor: Actor,
  imageUuid: string,
  input: ReviewImageInput
) {
  const image = await resolveOwnedImage(actor, imageUuid);

  const data: Prisma.ListingImageUpdateInput = {
    status: input.decision === 'APPROVE' ? ImageStatus.REVIEWED : ImageStatus.REJECTED,
    reviewer: { connect: { id: actor.id } },
    reviewedAt: new Date(),
  };
  if (input.cropMatchStatus) {
    data.cropMatchStatus = input.cropMatchStatus;
  }

  return prisma.listingImage.update({
    where: { id: image.id },
    data,
    select: imageSelect,
  });
}
