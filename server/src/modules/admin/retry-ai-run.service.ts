import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { transcribeResponse } from '../voice/voice.service';
import { analyseImage } from '../listings/images.service';
import { extractListing } from '../listings/listing-extraction.service';
import { retryTts } from '../audio/audio.service';

export interface Actor {
  id: number;
  role: UserRole;
}

const runSelect = {
  uuid: true,
  processableType: true,
  processableId: true,
  apiType: true,
  processingStatus: true,
  attempts: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
} as const;

// Re-dispatches a failed AI run to the appropriate module handler.
export async function retryAiRun(actor: Actor, runUuid: string) {
  const run = await prisma.aiProcessingRun.findUnique({
    where: { uuid: runUuid },
    select: {
      id: true,
      uuid: true,
      processableType: true,
      processableId: true,
      apiType: true,
      processingStatus: true,
      attempts: true,
    },
  });
  if (!run) {
    throw AppError.notFound('AI processing run not found');
  }

  await prisma.aiProcessingRun.update({
    where: { id: run.id },
    data: { attempts: { increment: 1 } },
  });

  switch (run.apiType) {
    case 'SPEECH_TO_TEXT': {
      const response = await prisma.voiceResponse.findUnique({
        where: { id: run.processableId },
        select: { uuid: true },
      });
      if (!response) throw AppError.notFound('Voice response not found for this run');
      await transcribeResponse(actor, response.uuid);
      break;
    }
    case 'VISION': {
      const image = await prisma.listingImage.findUnique({
        where: { id: run.processableId },
        select: { uuid: true },
      });
      if (!image) throw AppError.notFound('Listing image not found for this run');
      await analyseImage(actor, image.uuid);
      break;
    }
    case 'AGENT_CHAT': {
      const session = await prisma.voiceSession.findUnique({
        where: { id: run.processableId },
        select: { uuid: true },
      });
      if (!session) throw AppError.notFound('Voice session not found for this run');
      await extractListing(actor, session.uuid);
      break;
    }
    case 'TEXT_TO_SPEECH': {
      const audio = await prisma.generatedAudio.findUnique({
        where: { id: run.processableId },
        select: { uuid: true },
      });
      if (!audio) throw AppError.notFound('Generated audio not found for this run');
      await retryTts(actor, audio.uuid);
      break;
    }
    default:
      throw AppError.badRequest('This AI run type cannot be retried', 'RETRY_NOT_SUPPORTED');
  }

  const updated = await prisma.aiProcessingRun.findUnique({
    where: { uuid: runUuid },
    select: runSelect,
  });
  return updated!;
}
