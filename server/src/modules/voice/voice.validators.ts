import { z } from 'zod';
import { QuestionType } from '@prisma/client';

export const createSessionSchema = z.object({
  // Optional client-supplied reference; one is generated if absent.
  sessionReference: z.string().trim().min(3).max(80).optional(),
});

// Metadata that accompanies an uploaded audio answer (multipart text fields).
export const createResponseSchema = z.object({
  questionType: z.nativeEnum(QuestionType),
  language: z.string().trim().max(40).optional(),
  // Optional manual transcript provided up-front (manual fallback path).
  transcript: z.string().trim().max(5000).optional(),
});

export const updateTranscriptSchema = z
  .object({
    transcript: z.string().trim().max(5000).optional(),
    correctedTranscript: z.string().trim().max(5000).optional(),
  })
  .refine(
    (data) =>
      data.transcript !== undefined || data.correctedTranscript !== undefined,
    { message: 'Provide transcript or correctedTranscript' }
  );

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateResponseInput = z.infer<typeof createResponseSchema>;
export type UpdateTranscriptInput = z.infer<typeof updateTranscriptSchema>;
