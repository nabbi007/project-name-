import { z } from 'zod';
import { AudioMessageType } from '@prisma/client';

export const generateListingAudioSchema = z.object({
  language: z.string().trim().max(10).optional(),
  fields: z.array(z.string().trim().min(1).max(40)).min(1).max(10).optional(),
});

export const supplementVoiceSchema = z.object({
  language: z.string().trim().max(10).optional(),
});

export const generateOrderAudioSchema = z.object({
  messageType: z.enum([
    AudioMessageType.NEW_ORDER,
    AudioMessageType.ORDER_CANCELLED,
  ]),
  language: z.string().trim().max(10).optional(),
});

export type GenerateOrderAudioInput = z.infer<typeof generateOrderAudioSchema>;
