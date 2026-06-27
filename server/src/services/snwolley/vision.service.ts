import fs from 'fs';
import path from 'path';
import { AxiosError } from 'axios';
import { hackathonClient, hackathonAuthHeader } from '../../config/snwolley';
import { env } from '../../config/environment';
import { AppError } from '../../utils/AppError';

// ---------------------------------------------------------------------------
// Snwolley Vision (Image Recognition) adapter (Phase 6).
//
// Contract (Npontu Hackathon 2026):
//   POST {base}/api/v1/hackathon/vision
//   Headers: X-API-Key: <team key>
//   Body: multipart image field, OR JSON { image_url, prompt }
//   Success: { success: true, description: string }
//
// IMPORTANT: Vision output is an observation of visible image features only.
// It must never be presented as certified food-safety or laboratory analysis.
// ---------------------------------------------------------------------------

const VISION_ENDPOINT = '/vision';
const IMAGE_FIELD = 'image';

export interface VisionResult {
  description: string;
  raw: unknown;
}

function mimeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.heic':
      return 'image/heic';
    case '.heif':
      return 'image/heif';
    default:
      return 'application/octet-stream';
  }
}

function extractDescription(data: any): string {
  const candidate = data?.description ?? data?.text ?? '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

export async function analyseImageFile(
  absoluteFilePath: string,
  prompt: string
): Promise<VisionResult> {
  if (!env.SNWOLLEY_HACKATHON_API_KEY) {
    throw new AppError(
      'Vision is not configured. Review the image manually.',
      503,
      'VISION_NOT_CONFIGURED'
    );
  }
  if (!fs.existsSync(absoluteFilePath)) {
    throw new AppError('Image file not found', 404, 'IMAGE_NOT_FOUND');
  }

  const buffer = await fs.promises.readFile(absoluteFilePath);
  if (buffer.byteLength === 0) {
    throw new AppError('Image file is empty', 422, 'EMPTY_IMAGE');
  }

  const ext = path.extname(absoluteFilePath);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeForExtension(ext) });
  form.append(IMAGE_FIELD, blob, path.basename(absoluteFilePath));
  form.append('prompt', prompt);

  try {
    const response = await hackathonClient.post(VISION_ENDPOINT, form, {
      headers: { ...hackathonAuthHeader() },
    });

    const description = extractDescription(response.data);
    if (!description) {
      throw new AppError(
        'Vision returned an empty description. Please review manually.',
        422,
        'VISION_EMPTY'
      );
    }

    return { description, raw: response.data };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw mapVisionError(error);
  }
}

function mapVisionError(error: unknown): AppError {
  const axiosErr = error as AxiosError;
  if (axiosErr.code === 'ECONNABORTED') {
    return new AppError('Vision request timed out.', 504, 'VISION_TIMEOUT');
  }
  const status = axiosErr.response?.status;
  if (status === 400) {
    return new AppError('Vision rejected the request (bad image).', 422, 'VISION_BAD_REQUEST');
  }
  if (status === 401 || status === 403) {
    return new AppError('Vision authentication failed.', 502, 'VISION_AUTH_FAILED');
  }
  if (status === 429) {
    return new AppError('Vision rate limit reached. Please retry shortly.', 502, 'VISION_RATE_LIMITED');
  }
  if (status === 503) {
    return new AppError('Hackathon Vision API is not currently available.', 503, 'VISION_DISABLED');
  }
  return new AppError(
    'Vision service is unavailable. Please review the image manually.',
    502,
    'VISION_UNAVAILABLE'
  );
}
