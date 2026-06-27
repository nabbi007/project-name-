import { Prisma, UserRole, AudioMessageType } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { synthesizeSpeech } from '../../services/snwolley/text-to-speech.service';
import { uploadMedia } from '../../services/storage/storage.service';
import { buildMessage } from './notification-messages';
import { buildMissingFieldsPrompt, filterVoicePromptFields } from '../listings/missing-field-prompts';

export interface Actor {
  id: number;
  role: UserRole;
}

const audioSelect = {
  uuid: true,
  messageType: true,
  textContent: true,
  audioPath: true,
  processingStatus: true,
  playedAt: true,
  farmerConfirmedAt: true,
  createdAt: true,
} satisfies Prisma.GeneratedAudioSelect;

// Core: persist the record, call TTS, store the WAV, and log an AiProcessingRun.
async function generate(
  data: {
    farmerId: number;
    produceListingId?: number;
    orderId?: number;
    messageType: AudioMessageType;
    text: string;
  }
) {
  const audio = await prisma.generatedAudio.create({
    data: {
      farmerId: data.farmerId,
      produceListingId: data.produceListingId,
      orderId: data.orderId,
      messageType: data.messageType,
      textContent: data.text,
      processingStatus: 'PROCESSING',
    },
    select: { id: true, uuid: true },
  });

  const run = await prisma.aiProcessingRun.create({
    data: {
      processableType: 'GeneratedAudio',
      processableId: audio.id,
      apiType: 'TEXT_TO_SPEECH',
      requestSummary: data.messageType,
      processingStatus: 'PROCESSING',
      attempts: 1,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  try {
    const buffer = await synthesizeSpeech(data.text);
    const stored = await uploadMedia(buffer, 'generated-audio', '.wav');

    const updated = await prisma.generatedAudio.update({
      where: { id: audio.id },
      data: { audioPath: stored.url, processingStatus: 'COMPLETED' },
      select: audioSelect,
    });

    await prisma.aiProcessingRun.update({
      where: { id: run.id },
      data: { processingStatus: 'COMPLETED', httpStatus: 200, completedAt: new Date() },
    });

    return updated;
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError('Audio generation failed', 502, 'TTS_UNAVAILABLE');

    await prisma.generatedAudio.update({
      where: { id: audio.id },
      data: { processingStatus: 'FAILED' },
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

export async function generateForListing(
  actor: Actor,
  listingUuid: string,
  language = 'en'
) {
  const listing = await prisma.produceListing.findFirst({
    where: {
      uuid: listingUuid,
      ...(actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id }),
    },
    select: {
      id: true,
      title: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      farmerId: true,
      farmer: { select: { fullName: true, preferredLanguage: true } },
      cropCategory: { select: { name: true } },
    },
  });
  if (!listing) throw AppError.notFound('Listing not found');

  const text = buildMessage(
    AudioMessageType.LISTING_PUBLISHED,
    {
      farmerName: listing.farmer.fullName,
      crop: listing.cropCategory?.name ?? listing.title,
      quantity: Number(listing.quantity),
      unit: listing.unit,
      pricePerUnit: Number(listing.pricePerUnit),
    },
    listing.farmer.preferredLanguage ?? language
  );

  return generate({
    farmerId: listing.farmerId,
    produceListingId: listing.id,
    messageType: AudioMessageType.LISTING_PUBLISHED,
    text,
  });
}

export async function generateFieldPrompt(
  actor: Actor,
  listingUuid: string,
  fields: string[],
  language = 'en'
) {
  const promptFields = filterVoicePromptFields(fields);
  if (promptFields.length === 0) {
    throw AppError.badRequest('No missing fields to prompt for', 'NO_MISSING_FIELDS');
  }

  const listing = await prisma.produceListing.findFirst({
    where: {
      uuid: listingUuid,
      ...(actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id }),
    },
    select: {
      id: true,
      farmerId: true,
      farmer: { select: { fullName: true, preferredLanguage: true } },
    },
  });
  if (!listing) throw AppError.notFound('Listing not found');

  const text = buildMissingFieldsPrompt(
    promptFields,
    listing.farmer.fullName
  );

  return generate({
    farmerId: listing.farmerId,
    produceListingId: listing.id,
    messageType: AudioMessageType.LISTING_FIELD_PROMPT,
    text,
  });
}

export async function generateForOrder(
  actor: Actor,
  orderUuid: string,
  messageType: AudioMessageType,
  language = 'en'
) {
  if (
    messageType !== AudioMessageType.NEW_ORDER &&
    messageType !== AudioMessageType.ORDER_CANCELLED
  ) {
    throw AppError.badRequest('Unsupported message type for an order', 'INVALID_MESSAGE_TYPE');
  }

  const order = await prisma.order.findFirst({
    where: {
      uuid: orderUuid,
      ...(actor.role === UserRole.ADMIN
        ? {}
        : { items: { some: { produceListing: { fieldAgentId: actor.id } } } }),
    },
    select: {
      id: true,
      orderNumber: true,
      items: {
        take: 1,
        select: {
          quantity: true,
          produceListing: {
            select: {
              id: true,
              title: true,
              unit: true,
              farmerId: true,
              farmer: { select: { fullName: true, preferredLanguage: true } },
              cropCategory: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!order || order.items.length === 0) throw AppError.notFound('Order not found');

  const item = order.items[0];
  const listing = item.produceListing;
  const text = buildMessage(
    messageType,
    {
      farmerName: listing.farmer.fullName,
      crop: listing.cropCategory?.name ?? listing.title,
      quantity: Number(item.quantity),
      unit: listing.unit,
      orderNumber: order.orderNumber,
    },
    listing.farmer.preferredLanguage ?? language
  );

  return generate({
    farmerId: listing.farmerId,
    produceListingId: listing.id,
    orderId: order.id,
    messageType,
    text,
  });
}

export async function getAudio(actor: Actor, uuid: string) {
  // Buyers never access generated audio (farmer-facing notifications).
  if (actor.role === UserRole.BUYER) {
    throw AppError.forbidden('Not authorised to access generated audio');
  }
  const where: Prisma.GeneratedAudioWhereInput = { uuid };
  if (actor.role === UserRole.FIELD_AGENT) {
    where.OR = [
      { produceListing: { fieldAgentId: actor.id } },
      { farmer: { fieldAgentId: actor.id } },
    ];
  }
  const audio = await prisma.generatedAudio.findFirst({ where, select: audioSelect });
  if (!audio) throw AppError.notFound('Generated audio not found');
  return audio;
}

export async function markPlayed(actor: Actor, uuid: string) {
  await getAudio(actor, uuid);
  return prisma.generatedAudio.update({
    where: { uuid },
    data: { playedAt: new Date() },
    select: audioSelect,
  });
}

export async function markFarmerConfirmed(actor: Actor, uuid: string) {
  await getAudio(actor, uuid);
  return prisma.generatedAudio.update({
    where: { uuid },
    data: { farmerConfirmedAt: new Date() },
    select: audioSelect,
  });
}

// Re-synthesises TTS for an existing generated-audio record (admin retry / regenerate).
export async function retryTts(actor: Actor, uuid: string) {
  const where: Prisma.GeneratedAudioWhereInput = { uuid };
  if (actor.role === UserRole.FIELD_AGENT) {
    where.OR = [
      { produceListing: { fieldAgentId: actor.id } },
      { farmer: { fieldAgentId: actor.id } },
    ];
  }

  const audio = await prisma.generatedAudio.findFirst({
    where,
    select: { id: true, uuid: true, textContent: true, messageType: true },
  });
  if (!audio) throw AppError.notFound('Generated audio not found');

  const run = await prisma.aiProcessingRun.create({
    data: {
      processableType: 'GeneratedAudio',
      processableId: audio.id,
      apiType: 'TEXT_TO_SPEECH',
      requestSummary: `${audio.messageType} (retry)`,
      processingStatus: 'PROCESSING',
      attempts: 1,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.generatedAudio.update({
    where: { id: audio.id },
    data: { processingStatus: 'PROCESSING' },
  });

  try {
    const buffer = await synthesizeSpeech(audio.textContent);
    const stored = await uploadMedia(buffer, 'generated-audio', '.wav');

    const updated = await prisma.generatedAudio.update({
      where: { id: audio.id },
      data: { audioPath: stored.url, processingStatus: 'COMPLETED' },
      select: audioSelect,
    });

    await prisma.aiProcessingRun.update({
      where: { id: run.id },
      data: { processingStatus: 'COMPLETED', httpStatus: 200, completedAt: new Date() },
    });

    return updated;
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError('Audio generation failed', 502, 'TTS_UNAVAILABLE');

    await prisma.generatedAudio.update({
      where: { id: audio.id },
      data: { processingStatus: 'FAILED' },
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
