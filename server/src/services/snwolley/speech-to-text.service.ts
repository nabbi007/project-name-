import fs from 'fs';
import path from 'path';
import { AxiosError } from 'axios';
import {
  snwolleyClient,
  getHackathonAuthHeader,
} from '../../config/snwolley';
import { env } from '../../config/environment';
import { AppError } from '../../utils/AppError';

// ---------------------------------------------------------------------------
// Snwolley Speech-to-Text adapter (Phase 4).
//
// NOTE: Adjust STT_ENDPOINT, the request body, and the response parsing below
// to match the official Snwolley STT contract. The surrounding orchestration,
// error handling, and manual fallback do not change when the contract does.
// ---------------------------------------------------------------------------

const STT_ENDPOINT = '/v1/speech-to-text';
const AUDIO_FIELD = 'audio';

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
  // Try the most common response shapes; adjust to the real contract.
  const candidate =
    data?.text ??
    data?.transcript ??
    data?.data?.text ??
    data?.data?.transcript ??
    data?.result?.text ??
    '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function extractSessionId(data: any): string | null {
  return (
    data?.sessionId ??
    data?.session_id ??
    data?.id ??
    data?.data?.sessionId ??
    null
  );
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
  if (language) {
    form.append('language', language);
  }

  try {
    const response = await snwolleyClient.post(STT_ENDPOINT, form, {
      headers: {
        ...getHackathonAuthHeader(),
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

  return new AppError(
    'Speech-to-text service is unavailable. Please enter the transcript manually.',
    502,
    'STT_UNAVAILABLE'
  );
}
