import { env } from '../../config/environment';
import { chatWithAgent } from './agent-chat.service';
import { parseExtraction, type ExtractedListing } from '../../modules/listings/listing-extraction.service';

function isAgentConfigured(): boolean {
  return Boolean(env.SNWOLLEY_AGENT_API_KEY?.trim() && env.SNWOLLEY_AGENT_ID?.trim());
}

function buildSupplementPrompt(
  englishText: string,
  rawText: string,
  language: string | null | undefined,
  missingFields: string[]
): string {
  return [
    'A Ghanaian farmer answered a follow-up voice question for a produce listing.',
    `Farmer language: ${language ?? 'local'}.`,
    `We still need these fields: ${missingFields.join(', ')}.`,
    'Speech-to-text is often wrong — e.g. "cedis" may appear as "cities".',
    'Interpret what the farmer meant and extract ONLY the missing fields.',
    'Respond with ONLY a JSON object using these keys (null if unknown):',
    '{ "crop": string|null, "quantity": number|null, "unit": string|null,',
    '  "pricePerUnit": number|null, "availableDate": "YYYY-MM-DD"|null, "description": string|null }',
    '',
    `Raw STT: ${rawText}`,
    `Working text: ${englishText}`,
  ].join('\n');
}

/** Agent pass when rule-based supplement parse misses fields (common with Twi STT). */
export async function extractSupplementViaAgent(
  englishText: string,
  rawText: string,
  language: string | null | undefined,
  missingFields: string[]
): Promise<ExtractedListing | null> {
  if (!isAgentConfigured() || missingFields.length === 0) return null;

  try {
    const result = await chatWithAgent(
      buildSupplementPrompt(englishText, rawText, language, missingFields)
    );
    const parsed = parseExtraction(result.content);
    return parsed?.extracted ?? null;
  } catch {
    return null;
  }
}
