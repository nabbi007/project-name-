import { env } from '../../config/environment';
import { AppError } from '../../utils/AppError';
import { chatWithAgent } from './agent-chat.service';

export function isEnglishLanguage(language?: string | null): boolean {
  if (!language) return true;
  const code = language.trim().toLowerCase();
  return code === 'en' || code === 'english' || code === 'eng';
}

async function translateViaAgent(text: string, sourceLanguage: string): Promise<string> {
  const prompt =
    `Translate the following ${sourceLanguage} farmer speech to clear English. ` +
    `Return ONLY the English translation, no quotes or explanation:\n\n${text}`;
  const result = await chatWithAgent(prompt);
  const translated = result.content.trim();
  if (!translated) {
    throw new AppError('Agents API returned empty translation.', 502, 'TRANSLATE_EMPTY');
  }
  return translated;
}

/**
 * Optional Twi/Ga/Ewe → English via Snwolley Agents API when configured.
 * Otherwise returns empty english — the field agent types English manually.
 */
export async function translateToEnglish(
  text: string,
  sourceLanguage?: string | null
): Promise<{ english: string; translated: boolean }> {
  const trimmed = text.trim();
  if (!trimmed || isEnglishLanguage(sourceLanguage)) {
    return { english: trimmed, translated: false };
  }

  if (env.SNWOLLEY_AGENT_API_KEY && env.SNWOLLEY_AGENT_ID) {
    try {
      return {
        english: await translateViaAgent(trimmed, sourceLanguage ?? 'local language'),
        translated: true,
      };
    } catch {
      return { english: '', translated: false };
    }
  }

  return { english: '', translated: false };
}
