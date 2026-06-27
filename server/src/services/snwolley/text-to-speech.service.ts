import { AxiosError } from 'axios';
import { hackathonClient, hackathonAuthHeader } from '../../config/snwolley';
import { env } from '../../config/environment';
import { AppError } from '../../utils/AppError';

// ---------------------------------------------------------------------------
// Snwolley Text-to-Speech adapter (Phase 8).
//
// Contract (Npontu Hackathon 2026):
//   POST {base}/api/v1/hackathon/tts
//   Headers: X-API-Key: <team key>
//   Body: JSON { text }
//   Success: binary WAV audio
//   Error:   { error: string }
// ---------------------------------------------------------------------------

const TTS_ENDPOINT = '/tts';

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  if (!env.SNWOLLEY_HACKATHON_API_KEY) {
    throw new AppError(
      'Text-to-speech is not configured.',
      503,
      'TTS_NOT_CONFIGURED'
    );
  }
  if (!text.trim()) {
    throw new AppError('No text provided for speech synthesis', 422, 'TTS_EMPTY_TEXT');
  }

  try {
    const response = await hackathonClient.post(
      TTS_ENDPOINT,
      { text },
      { headers: { ...hackathonAuthHeader() }, responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);
    if (buffer.byteLength === 0) {
      throw new AppError('Text-to-speech returned empty audio.', 502, 'TTS_EMPTY');
    }
    return buffer;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw mapTtsError(error);
  }
}

function mapTtsError(error: unknown): AppError {
  const axiosErr = error as AxiosError;
  if (axiosErr.code === 'ECONNABORTED') {
    return new AppError('Text-to-speech request timed out.', 504, 'TTS_TIMEOUT');
  }
  const status = axiosErr.response?.status;
  if (status === 400) {
    return new AppError('Text-to-speech rejected the request.', 422, 'TTS_BAD_REQUEST');
  }
  if (status === 401 || status === 403) {
    return new AppError('Text-to-speech authentication failed.', 502, 'TTS_AUTH_FAILED');
  }
  if (status === 429) {
    return new AppError('Text-to-speech rate limit reached. Please retry shortly.', 502, 'TTS_RATE_LIMITED');
  }
  if (status === 503) {
    return new AppError('Hackathon text-to-speech API is not currently available.', 503, 'TTS_DISABLED');
  }
  return new AppError('Text-to-speech service is unavailable.', 502, 'TTS_UNAVAILABLE');
}
