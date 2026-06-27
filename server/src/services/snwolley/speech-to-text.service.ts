import fs from 'fs';
import path from 'path';
import { AxiosError } from 'axios';
import { hackathonClient, hackathonAuthHeader } from '../../config/snwolley';
import { env } from '../../config/environment';
import { AppError } from '../../utils/AppError';

// ---------------------------------------------------------------------------
// Snwolley Speech-to-Text adapter (Phase 4).
//
// Contract (Npontu Hackathon 2026):
//   POST {base}/api/v1/hackathon/stt
//   Headers: X-API-Key: <team key>
//   Body (multipart/form-data): audio (file), language (optional, default en),
//                               session_id (optional)
//   Success: { success: true, text: string, session_id: string }
//   Error:   { error: string }  with HTTP 400/401/429/500/503
// ---------------------------------------------------------------------------

const STT_ENDPOINT = '/stt';
const AUDIO_FIELD = 'audio';
const DEFAULT_LANGUAGE = 'en';

/** Alternate STT tags to try per farmer locale (Snwolley may accept tw or twi). */
const STT_LANGUAGE_ATTEMPTS: Record<string, string[]> = {
  tw: ['tw', 'twi', 'ak'],
  ga: ['ga', 'gaa'],
  ee: ['ee', 'ewe'],
};

/** Map farmer locale codes to STT language tags. */
export function normalizeSttLanguage(language?: string): string {
  if (!language) return DEFAULT_LANGUAGE;
  const code = language.trim().toLowerCase();
  if (code === 'en' || code === 'english') return 'en';
  if (code === 'twi' || code === 'tw') return 'tw';
  if (code === 'ga' || code === 'gaa') return 'ga';
  if (code === 'ewe' || code === 'ee') return 'ee';
  return code.length <= 5 ? code : DEFAULT_LANGUAGE;
}

export interface SttResult {
  transcript: string;
  sttSessionId: string | null;
  raw: unknown;
}

function mimeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    case '.aac':
      return 'audio/aac';
    case '.ogg':
      return 'audio/ogg';
    case '.webm':
      return 'audio/webm';
    case '.3gp':
      return 'audio/3gpp';
    default:
      return 'application/octet-stream';
  }
}

function extractTranscript(data: any): string {
  const candidate = data?.text ?? data?.transcript ?? '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function extractSessionId(data: any): string | null {
  const id = data?.session_id ?? data?.sessionId ?? null;
  return id != null ? String(id) : null;
}

function buildSttForm(buffer: Buffer, filename: string, language: string): FormData {
  const ext = path.extname(filename) || '.wav';
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeForExtension(ext) });
  const form = new FormData();
  form.append(AUDIO_FIELD, blob, path.basename(filename) || `audio${ext}`);
  form.append('language', language);
  return form;
}

async function callStt(form: FormData): Promise<SttResult> {
  try {
    const response = await hackathonClient.post(STT_ENDPOINT, form, {
      headers: {
        ...hackathonAuthHeader(),
      },
    });

    const transcript = extractTranscript(response.data);
    if (!transcript) {
      throw new AppError(
        'Speech-to-text returned an empty transcript. Please correct manually.',
        422,
        'EMPTY_TRANSCRIPT'
      );
    }

    return {
      transcript,
      sttSessionId: extractSessionId(response.data),
      raw: response.data,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw mapAxiosError(error);
  }
}

// Reads a local file and transcribes it (kept for tests / local fallback).
export async function transcribeAudio(
  absoluteFilePath: string,
  language?: string
): Promise<SttResult> {
  if (!fs.existsSync(absoluteFilePath)) {
    throw new AppError('Audio file not found', 404, 'AUDIO_NOT_FOUND');
  }
  const buffer = await fs.promises.readFile(absoluteFilePath);
  return transcribeAudioBuffer(buffer, path.basename(absoluteFilePath), language);
}

// Transcribes an in-memory audio buffer (used on upload and for retries).
export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string,
  language?: string
): Promise<SttResult> {
  if (!env.SNWOLLEY_HACKATHON_API_KEY) {
    throw new AppError(
      'Speech-to-text is not configured. Enter the transcript manually.',
      503,
      'STT_NOT_CONFIGURED'
    );
  }

  if (buffer.byteLength === 0) {
    throw new AppError('Audio recording is empty', 422, 'EMPTY_AUDIO');
  }

  const primaryLang = normalizeSttLanguage(language);
  const localAttempts =
    primaryLang === DEFAULT_LANGUAGE
      ? [DEFAULT_LANGUAGE]
      : STT_LANGUAGE_ATTEMPTS[primaryLang] ?? [primaryLang];
  // Snwolley often only accepts `en`. Try local tags first, then English as last resort
  // so retry/upload does not hard-fail with 502 (agent can correct misheard text).
  const attempts =
    primaryLang === DEFAULT_LANGUAGE ? localAttempts : [...localAttempts, DEFAULT_LANGUAGE];

  let lastError: unknown;
  for (const lang of attempts) {
    try {
      return await callStt(buildSttForm(buffer, filename, lang));
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }
  throw mapAxiosError(lastError);
}

function mapAxiosError(error: unknown): AppError {
  const axiosErr = error as AxiosError;

  if (axiosErr.code === 'ECONNABORTED') {
    return new AppError(
      'Speech-to-text request timed out. Please retry or enter manually.',
      504,
      'STT_TIMEOUT'
    );
  }

  const status = axiosErr.response?.status;
  if (status === 400) {
    return new AppError(
      'Speech-to-text rejected the request (bad audio or missing file).',
      422,
      'STT_BAD_REQUEST'
    );
  }
  if (status === 401 || status === 403) {
    return new AppError(
      'Speech-to-text authentication failed.',
      502,
      'STT_AUTH_FAILED'
    );
  }
  if (status === 429) {
    return new AppError(
      'Speech-to-text rate limit reached. Please retry shortly.',
      502,
      'STT_RATE_LIMITED'
    );
  }
  if (status === 503) {
    return new AppError(
      'Hackathon speech-to-text API is not currently available.',
      503,
      'STT_DISABLED'
    );
  }

  return new AppError(
    'Speech-to-text service is unavailable. Please enter the transcript manually.',
    502,
    'STT_UNAVAILABLE'
  );
}
