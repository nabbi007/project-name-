import { CropMatchStatus } from '@prisma/client';
import { chatWithAgent } from './agent-chat.service';

// ---------------------------------------------------------------------------
// Turns a free-text Vision description into a structured observation.
// Prefers the Agents API; falls back to a heuristic object when the Agents API
// is not configured or fails, so the flow always produces a reviewable result.
// ---------------------------------------------------------------------------

const VISIBLE_FEATURES_WARNING =
  'Observation is based only on visible image features. This is not a certified food-safety or laboratory analysis.';

export interface StructuredObservation {
  identifiedCrop: string | null;
  colour: string | null;
  maturity: string | null;
  visibleCondition: string | null;
  visibleIssues: string[];
  recommendation: string;
  warning: string;
}

function stripFences(content: string): string {
  const m = content.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m ? m[1] : content).trim();
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const cleaned = stripFences(content);
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

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  }
  return [];
}

function heuristicObservation(description: string): StructuredObservation {
  return {
    identifiedCrop: null,
    colour: null,
    maturity: null,
    visibleCondition: description.slice(0, 280),
    visibleIssues: [],
    recommendation: 'Human review required',
    warning: VISIBLE_FEATURES_WARNING,
  };
}

export async function structureObservation(
  description: string,
  expectedCrop: string | null
): Promise<{ observation: StructuredObservation; viaAgent: boolean }> {
  const prompt = [
    'Convert the following crop image description into a JSON object with EXACTLY these keys:',
    '{',
    '  "identifiedCrop": string,      // the crop you see, or null',
    '  "colour": string,              // dominant colours, or null',
    '  "maturity": string,            // ripeness/maturity, or null',
    '  "visibleCondition": string,    // overall visible condition, or null',
    '  "visibleIssues": string[],     // visible problems, e.g. ["bruising"]',
    '  "recommendation": string,      // e.g. "Human review required"',
    '  "warning": string              // limitations of image-only observation',
    '}',
    'Respond with ONLY the JSON object.',
    '',
    `Description: ${description}`,
  ].join('\n');

  try {
    const result = await chatWithAgent(prompt);
    const parsed = parseJsonObject(result.content);
    if (!parsed) {
      return { observation: heuristicObservation(description), viaAgent: false };
    }
    return {
      observation: {
        identifiedCrop: asString(parsed.identifiedCrop),
        colour: asString(parsed.colour),
        maturity: asString(parsed.maturity),
        visibleCondition: asString(parsed.visibleCondition),
        visibleIssues: asStringArray(parsed.visibleIssues),
        recommendation: asString(parsed.recommendation) ?? 'Human review required',
        // Always enforce our limitation warning regardless of model output.
        warning: VISIBLE_FEATURES_WARNING,
      },
      viaAgent: true,
    };
  } catch {
    // Agents API unavailable -> heuristic fallback (still reviewable).
    void expectedCrop;
    return { observation: heuristicObservation(description), viaAgent: false };
  }
}

// Compares the agent's selected crop with what the image suggests.
export function computeCropMatch(
  expectedCrop: string | null,
  observation: StructuredObservation,
  description: string
): CropMatchStatus {
  if (!expectedCrop) {
    return CropMatchStatus.MANUAL_REVIEW_REQUIRED;
  }
  const expected = expectedCrop.toLowerCase().trim();
  const identified = (observation.identifiedCrop ?? '').toLowerCase().trim();
  const haystack = `${identified} ${description.toLowerCase()}`;

  if (identified) {
    if (identified.includes(expected) || expected.includes(identified)) {
      return CropMatchStatus.MATCH;
    }
    // Identified something specific that doesn't contain the expected crop.
    return CropMatchStatus.MISMATCH;
  }

  // No explicit identified crop: fall back to scanning the description text.
  if (haystack.includes(expected)) {
    return CropMatchStatus.MATCH;
  }
  return CropMatchStatus.MANUAL_REVIEW_REQUIRED;
}

export { VISIBLE_FEATURES_WARNING };
