import path from 'path';
import crypto from 'crypto';
import {
  Prisma,
  ProcessingStatus,
  UserRole,
  VoiceSessionStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { transcribeAudioBuffer } from '../../services/snwolley/speech-to-text.service';
import { translateToEnglish, isEnglishLanguage } from '../../services/snwolley/translate.service';
import { fetchMedia } from '../../services/storage/storage.service';
import {
  CreateResponseInput,
  CreateSessionInput,
  UpdateTranscriptInput,
} from './voice.validators';

export interface Actor {
  id: number;
  role: UserRole;
}

const responseSelect = {
  uuid: true,
  questionType: true,
  audioPath: true,
  language: true,
  sttSessionId: true,
  transcript: true,
  correctedTranscript: true,
  processingStatus: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VoiceResponseSelect;

const sessionSelect = {
  uuid: true,
  sessionReference: true,
  status: true,
  startedAt: true,
  completedAt: true,
  farmer: { select: { uuid: true, fullName: true } },
  responses: { select: responseSelect, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.VoiceSessionSelect;

function agentScope(actor: Actor): Prisma.VoiceSessionWhereInput {
  return actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id };
}

// Resolves a farmer the actor is allowed to act on.
async function resolveOwnedFarmer(actor: Actor, farmerUuid: string) {
  const farmer = await prisma.farmer.findFirst({
    where: {
      uuid: farmerUuid,
      ...(actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id }),
    },
    select: { id: true },
  });
  if (!farmer) {
    throw AppError.notFound('Farmer not found');
  }
  return farmer;
}

export async function createSession(
  actor: Actor,
  farmerUuid: string,
  input: CreateSessionInput
) {
  const farmer = await resolveOwnedFarmer(actor, farmerUuid);
  const sessionReference =
    input.sessionReference ?? `VS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  return prisma.voiceSession.create({
    data: {
      farmerId: farmer.id,
      fieldAgentId: actor.id,
      sessionReference,
      status: VoiceSessionStatus.IN_PROGRESS,
    },
    select: sessionSelect,
  });
}

export async function getSession(actor: Actor, sessionUuid: string) {
  const session = await prisma.voiceSession.findFirst({
    where: { uuid: sessionUuid, ...agentScope(actor) },
    select: sessionSelect,
  });
  if (!session) {
    throw AppError.notFound('Voice session not found');
  }
  return session;
}

async function resolveOwnedSessionId(
  actor: Actor,
  sessionUuid: string
): Promise<number> {
  const session = await prisma.voiceSession.findFirst({
    where: { uuid: sessionUuid, ...agentScope(actor) },
    select: { id: true },
  });
  if (!session) {
    throw AppError.notFound('Voice session not found');
  }
  return session.id;
}

export async function addResponse(
  actor: Actor,
  sessionUuid: string,
  input: CreateResponseInput,
  audioRelPath: string | null
) {
  const sessionId = await resolveOwnedSessionId(actor, sessionUuid);

  // If a manual transcript is supplied up-front, mark it completed.
  const hasManual = !!input.transcript;

  return prisma.voiceResponse.create({
    data: {
      voiceSessionId: sessionId,
      questionType: input.questionType,
      audioPath: audioRelPath,
      language: input.language,
      transcript: input.transcript,
      processingStatus: hasManual
        ? ProcessingStatus.COMPLETED
        : ProcessingStatus.PENDING,
    },
    select: responseSelect,
  });
}

// Loads a response enforcing ownership through its session.
async function resolveOwnedResponse(actor: Actor, responseUuid: string) {
  const response = await prisma.voiceResponse.findFirst({
    where: {
      uuid: responseUuid,
      voiceSession:
        actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id },
    },
    select: {
      id: true,
      audioPath: true,
      language: true,
    },
  });
  if (!response) {
    throw AppError.notFound('Voice response not found');
  }
  return response;
}

// Orchestrates a transcription attempt with full AiProcessingRun logging.
type AudioSource =
  | { kind: 'buffer'; buffer: Buffer; filename: string }
  | { kind: 'ref'; ref: string };

async function runTranscription(
  responseId: number,
  source: AudioSource,
  language: string | null
) {
  const filename =
    source.kind === 'buffer' ? source.filename : path.basename(source.ref);

  const run = await prisma.aiProcessingRun.create({
    data: {
      processableType: 'VoiceResponse',
      processableId: responseId,
      apiType: 'SPEECH_TO_TEXT',
      requestSummary: `STT for ${filename}`,
      processingStatus: ProcessingStatus.PROCESSING,
      attempts: 1,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.voiceResponse.update({
    where: { id: responseId },
    data: {
      processingStatus: ProcessingStatus.PROCESSING,
      errorMessage: null,
    },
  });

  try {
    const buffer =
      source.kind === 'buffer' ? source.buffer : await fetchMedia(source.ref);
    const result = await transcribeAudioBuffer(buffer, filename, language ?? undefined);

    let transcript = result.transcript;
    let correctedTranscript: string | null = null;

    if (!isEnglishLanguage(language)) {
      const { english, translated } = await translateToEnglish(transcript, language);
      if (translated && english) {
        correctedTranscript = english;
      }
    }

    const updated = await prisma.voiceResponse.update({
      where: { id: responseId },
      data: {
        transcript,
        correctedTranscript,
        sttSessionId: result.sttSessionId,
        processingStatus: ProcessingStatus.COMPLETED,
        errorMessage: null,
      },
      select: responseSelect,
    });

    await prisma.aiProcessingRun.update({
      where: { id: run.id },
      data: {
        processingStatus: ProcessingStatus.COMPLETED,
        sessionId: result.sttSessionId,
        responseContent: (correctedTranscript ?? transcript).slice(0, 2000),
        httpStatus: 200,
        completedAt: new Date(),
      },
    });

    return updated;
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError('Transcription failed', 502, 'STT_UNAVAILABLE');

    await prisma.voiceResponse.update({
      where: { id: responseId },
      data: {
        processingStatus: ProcessingStatus.FAILED,
        errorMessage: appErr.message,
      },
    });

    await prisma.aiProcessingRun.update({
      where: { id: run.id },
      data: {
        processingStatus: ProcessingStatus.FAILED,
        httpStatus: appErr.statusCode,
        errorMessage: appErr.message,
        completedAt: new Date(),
      },
    });

    throw appErr;
  }
}

export async function autoTranscribeResponse(
  actor: Actor,
  responseUuid: string,
  buffer: Buffer,
  filename: string
) {
  const response = await resolveOwnedResponse(actor, responseUuid);
  try {
    return await runTranscription(
      response.id,
      { kind: 'buffer', buffer, filename },
      response.language
    );
  } catch {
    return prisma.voiceResponse.findFirstOrThrow({
      where: { uuid: responseUuid },
      select: responseSelect,
    });
  }
}

export async function transcribeResponse(actor: Actor, responseUuid: string) {
  const response = await resolveOwnedResponse(actor, responseUuid);
  if (!response.audioPath) {
    throw AppError.badRequest(
      'This response has no audio to transcribe',
      'NO_AUDIO'
    );
  }
  return runTranscription(
    response.id,
    { kind: 'ref', ref: response.audioPath },
    response.language
  );
}

export async function retryTranscription(actor: Actor, responseUuid: string) {
  // Same path as transcribe; attempts counter is incremented inside.
  return transcribeResponse(actor, responseUuid);
}

export async function updateTranscript(
  actor: Actor,
  responseUuid: string,
  input: UpdateTranscriptInput
) {
  const response = await resolveOwnedResponse(actor, responseUuid);

  const data: Prisma.VoiceResponseUpdateInput = {
    processingStatus: ProcessingStatus.COMPLETED,
    errorMessage: null,
  };
  if (input.transcript !== undefined) {
    data.transcript = input.transcript;
  }
  if (input.correctedTranscript !== undefined) {
    data.correctedTranscript = input.correctedTranscript;
  }

  return prisma.voiceResponse.update({
    where: { id: response.id },
    data,
    select: responseSelect,
  });
}

export async function attachAudioPath(responseUuid: string, audioPath: string) {
  return prisma.voiceResponse.update({
    where: { uuid: responseUuid },
    data: { audioPath },
    select: responseSelect,
  });
}
