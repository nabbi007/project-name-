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
  return data?.session_id ?? data?.sessionId ?? null;
}

export async function transcribeAudio(
  absoluteFilePath: string,
  language?: string
): Promise<SttResult> {
  if (!env.SNWOLLEY_HACKATHON_API_KEY) {
    throw new AppError(
      'Speech-to-text is not configured. Enter the transcript manually.',
      503,
      'STT_NOT_CONFIGURED'
    );
  }

  if (!fs.existsSync(absoluteFilePath)) {
    throw new AppError('Audio file not found', 404, 'AUDIO_NOT_FOUND');
  }

  const buffer = await fs.promises.readFile(absoluteFilePath);
  if (buffer.byteLength === 0) {
    throw new AppError('Audio recording is empty', 422, 'EMPTY_AUDIO');
  }

  const ext = path.extname(absoluteFilePath);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeForExtension(ext) });
  form.append(AUDIO_FIELD, blob, path.basename(absoluteFilePath));
  form.append('language', language || DEFAULT_LANGUAGE);

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
