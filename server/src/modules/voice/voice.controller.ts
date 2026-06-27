import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { audioExtension } from '../../middleware/upload.middleware';
import { uploadMedia } from '../../services/storage/storage.service';
import {
  createSessionSchema,
  createResponseSchema,
  updateTranscriptSchema,
} from './voice.validators';
import {
  Actor,
  addResponse,
  createSession,
  getSession,
  retryTranscription,
  transcribeResponse,
  updateTranscript,
  completeSession,
} from './voice.service';

function getActor(req: Request): Actor {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  return { id: req.user.id, role: req.user.role };
}

const param = (req: Request, key: string): string => String(req.params[key]);

// POST /api/farmers/:farmerId/voice-sessions
export async function create(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = createSessionSchema.parse(req.body ?? {});
  const session = await createSession(actor, param(req, 'farmerId'), input);
  sendCreated(res, { session }, 'Voice session created');
}

// GET /api/voice-sessions/:sessionId
export async function detail(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const session = await getSession(actor, param(req, 'sessionId'));
  sendSuccess(res, { session }, 'Voice session retrieved');
}

// POST /api/voice-sessions/:sessionId/responses  (multipart: audio + fields)
export async function response(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = createResponseSchema.parse(req.body);

  if (!req.file && !input.transcript) {
    throw AppError.badRequest(
      'Provide an audio file or a manual transcript',
      'NO_AUDIO_OR_TRANSCRIPT'
    );
  }

  let audioRef: string | null = null;
  if (req.file) {
    const stored = await uploadMedia(
      req.file.buffer,
      'audio',
      audioExtension(req.file.mimetype)
    );
    audioRef = stored.url;
  }

  const created = await addResponse(actor, param(req, 'sessionId'), input, audioRef);
  sendCreated(res, { response: created }, 'Voice response saved');
}

// POST /api/voice-responses/:responseId/transcribe
export async function transcribe(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const updated = await transcribeResponse(actor, param(req, 'responseId'));
  sendSuccess(res, { response: updated }, 'Transcription completed');
}

// POST /api/voice-responses/:responseId/retry
export async function retry(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const updated = await retryTranscription(actor, param(req, 'responseId'));
  sendSuccess(res, { response: updated }, 'Transcription retried');
}

// PATCH /api/voice-responses/:responseId/transcript
export async function correctTranscript(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const input = updateTranscriptSchema.parse(req.body);
  const updated = await updateTranscript(actor, param(req, 'responseId'), input);
  sendSuccess(res, { response: updated }, 'Transcript updated');
}

// POST /api/voice-sessions/:sessionId/complete
export async function complete(req: Request, res: Response): Promise<void> {
  const actor = getActor(req);
  const session = await completeSession(actor, param(req, 'sessionId'));
  sendSuccess(res, { session }, 'Voice session completed');
}
