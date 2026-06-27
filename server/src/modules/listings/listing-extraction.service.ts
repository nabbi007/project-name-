import { Prisma, UserRole, ListingStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { uniqueSlug } from '../../utils/slug';
import { chatWithAgent } from '../../services/snwolley/agent-chat.service';
import { normaliseUnit } from './listing.constants';

export interface Actor {
  id: number;
  role: UserRole;
}

export interface ExtractedListing {
  crop: string | null;
  quantity: number | null;
  unit: string | null;
  pricePerUnit: number | null;
  availableDate: string | null;
  description: string | null;
}

function agentScope(actor: Actor): Prisma.VoiceSessionWhereInput {
  return actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id };
}

// Removes ```json ... ``` / ``` ... ``` fences the agent may wrap JSON in.
function stripCodeFences(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

// Attempts to find a JSON object inside the content and parse it.
function safeParseJson(content: string): Record<string, unknown> | null {
  const cleaned = stripCodeFences(content);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    const parsed = JSON.parse(candidate);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function buildPrompt(transcriptBlock: string): string {
  return [
    'You are helping a field agent turn a farmer\'s spoken answers into a produce listing.',
    'Extract the following fields from the transcript and respond with ONLY a JSON object, no extra text:',
    '{',
    '  "crop": string,            // the crop name, e.g. "Tomato"',
    '  "quantity": number,        // numeric amount, e.g. 10',
    '  "unit": string,            // unit of sale, e.g. "BASKET", "BAG", "KG"',
    '  "pricePerUnit": number,    // price per unit in Ghana cedis, e.g. 180',
    '  "availableDate": string,   // ISO date YYYY-MM-DD when produce is available',
    '  "description": string      // a short plain-text description',
    '}',
    'If a field is unknown, use null. Do not invent values.',
    '',
    'Transcript:',
    transcriptBlock,
  ].join('\n');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && value.trim() !== '' ? n : null;
  }
  return null;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Pure parse + validate of an agent response. Returns null if the content is
// not valid JSON. cropCategory mapping (DB-dependent) is handled by the caller.
export function parseExtraction(
  content: string
): { extracted: ExtractedListing; incompleteFields: string[] } | null {
  const parsed = safeParseJson(content);
  if (!parsed) return null;

  const crop =
    typeof parsed.crop === 'string' && parsed.crop.trim() ? parsed.crop.trim() : null;
  const quantity = toNumber(parsed.quantity);
  const unit = normaliseUnit(parsed.unit);
  const pricePerUnit = toNumber(parsed.pricePerUnit);
  const availableDate = toIsoDate(parsed.availableDate);
  const description =
    typeof parsed.description === 'string' && parsed.description.trim()
      ? parsed.description.trim()
      : null;

  const incompleteFields: string[] = [];
  if (!crop) incompleteFields.push('crop');
  if (quantity === null || quantity <= 0) incompleteFields.push('quantity');
  if (!unit) incompleteFields.push('unit');
  if (pricePerUnit === null || pricePerUnit <= 0) incompleteFields.push('pricePerUnit');
  if (!availableDate) incompleteFields.push('availableDate');
  if (!description) incompleteFields.push('description');

  return {
    extracted: { crop, quantity, unit, pricePerUnit, availableDate, description },
    incompleteFields,
  };
}

export async function extractListing(actor: Actor, sessionUuid: string) {
  const session = await prisma.voiceSession.findFirst({
    where: { uuid: sessionUuid, ...agentScope(actor) },
    select: {
      id: true,
      farmerId: true,
      fieldAgentId: true,
      responses: {
        select: {
          questionType: true,
          transcript: true,
          correctedTranscript: true,
          processingStatus: true,
        },
      },
    },
  });
  if (!session) {
    throw AppError.notFound('Voice session not found');
  }

  // Prefer corrected transcript over the original; only use completed answers.
  const parts: string[] = [];
  for (const r of session.responses) {
    if (r.processingStatus !== 'COMPLETED') continue;
    const text = (r.correctedTranscript ?? r.transcript ?? '').trim();
    if (text) {
      parts.push(`${r.questionType}: ${text}`);
    }
  }

  if (parts.length === 0) {
    throw AppError.badRequest(
      'No completed transcripts available to extract from',
      'NO_TRANSCRIPTS'
    );
  }

  const transcriptBlock = parts.join('\n');
  const prompt = buildPrompt(transcriptBlock);

  const run = await prisma.aiProcessingRun.create({
    data: {
      processableType: 'VoiceSession',
      processableId: session.id,
      apiType: 'AGENT_CHAT',
      requestSummary: 'Listing extraction',
      processingStatus: 'PROCESSING',
      attempts: 1,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  let agentResult;
  try {
    agentResult = await chatWithAgent(prompt);
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError('Listing extraction failed', 502, 'AGENT_UNAVAILABLE');
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

  const parsedResult = parseExtraction(agentResult.content);
  if (!parsedResult) {
    await prisma.aiProcessingRun.update({
      where: { id: run.id },
      data: {
        processingStatus: 'FAILED',
        sessionId: agentResult.chatId,
        responseContent: agentResult.content.slice(0, 2000),
        errorMessage: 'Agent response was not valid JSON',
        completedAt: new Date(),
      },
    });
    throw new AppError(
      'Could not parse the AI response. Please complete the listing manually.',
      422,
      'AGENT_INVALID_JSON'
    );
  }

  const { crop, quantity, unit, pricePerUnit, availableDate, description } =
    parsedResult.extracted;
  const incompleteFields = [...parsedResult.incompleteFields];

  // Map crop to a crop category if one exists.
  let cropCategoryId: number | null = null;
  if (crop) {
    const category = await prisma.cropCategory.findFirst({
      where: {
        OR: [
          { name: { equals: crop, mode: 'insensitive' } },
          { slug: { equals: crop.toLowerCase(), mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    cropCategoryId = category?.id ?? null;
  }
  if (!cropCategoryId) incompleteFields.push('cropCategory');

  const titleBits = [quantity ?? '', unit ?? '', crop ?? 'Produce'].filter(Boolean);
  const title = titleBits.join(' ').trim() || 'Draft listing';

  // The AI result is NEVER auto-published. Always create a DRAFT.
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: session.farmerId,
      fieldAgentId: session.fieldAgentId,
      voiceSessionId: session.id,
      cropCategoryId,
      title,
      slug: uniqueSlug(crop ?? 'listing'),
      description,
      quantity: quantity ?? 0,
      availableQuantity: quantity ?? 0,
      unit,
      pricePerUnit: pricePerUnit ?? 0,
      availableDate: availableDate ? new Date(availableDate) : null,
      status: ListingStatus.DRAFT,
    },
    select: {
      uuid: true,
      title: true,
      slug: true,
      description: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      availableDate: true,
      cropCategoryId: true,
      status: true,
      createdAt: true,
    },
  });

  await prisma.aiProcessingRun.update({
    where: { id: run.id },
    data: {
      processingStatus: 'COMPLETED',
      sessionId: agentResult.chatId,
      responseContent: agentResult.content.slice(0, 2000),
      httpStatus: 200,
      completedAt: new Date(),
    },
  });

  const extracted: ExtractedListing = {
    crop,
    quantity,
    unit,
    pricePerUnit,
    availableDate,
    description,
  };

  return { listing, extracted, incompleteFields, chatId: agentResult.chatId };
}
