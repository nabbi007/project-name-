import { z } from 'zod';
import { AudioMessageType } from '@prisma/client';

export const generateListingAudioSchema = z.object({
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
