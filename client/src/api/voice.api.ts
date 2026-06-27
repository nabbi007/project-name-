import apiClient from './api-client';
import { blobToWav } from '../utils/audioToWav';

export type VoiceStep =
  | 'CROP'
  | 'QUANTITY'
  | 'UNIT'
  | 'AVAILABILITY'
  | 'PRICE'
  | 'DESCRIPTION';

type QuestionType =
  | 'CROP'
  | 'QUANTITY'
  | 'UNIT'
  | 'AVAILABILITY_DATE'
  | 'PRICE'
  | 'ADDITIONAL_INFORMATION';

const STEP_TO_QUESTION: Record<VoiceStep, QuestionType> = {
  CROP: 'CROP',
  QUANTITY: 'QUANTITY',
  UNIT: 'UNIT',
  AVAILABILITY: 'AVAILABILITY_DATE',
  PRICE: 'PRICE',
  DESCRIPTION: 'ADDITIONAL_INFORMATION',
};

/** Normalize farmer locale for the API `language` field (API.md §3.5). */
export function normalizeVoiceLanguage(language?: string | null): string {
  if (!language) return 'en';
  const code = language.trim().toLowerCase();
  if (code === 'english' || code === 'eng') return 'en';
  if (code === 'twi') return 'tw';
  if (code === 'gaa') return 'ga';
  if (code === 'ewe') return 'ee';
  return code.length <= 5 ? code : 'en';
}

export interface VoiceSession {
  _id: string;
  farmerId: string;
  status: string;
  createdAt: string;
}

interface RawVoiceResponse {
  uuid: string;
  questionType: QuestionType;
  transcript?: string | null;
  correctedTranscript?: string | null;
  processingStatus: string;
  errorMessage?: string | null;
}

interface RawVoiceSession {
  uuid?: string;
  _id?: string;
  farmerId?: string;
  farmer?: { uuid: string };
  status: string;
  createdAt?: string;
  startedAt?: string;
  responses?: RawVoiceResponse[];
}

function mapSession(raw: RawVoiceSession): VoiceSession {
  return {
    _id: raw.uuid ?? raw._id ?? '',
    farmerId: raw.farmerId ?? raw.farmer?.uuid ?? '',
    status: raw.status,
    createdAt: raw.createdAt ?? raw.startedAt ?? new Date().toISOString(),
  };
}

export interface UploadVoiceResponseResult {
  transcript: string;
  originalTranscript?: string;
  step: VoiceStep;
  responseId: string;
  transcriptionFailed?: boolean;
  errorMessage?: string;
}

function displayTranscript(response: RawVoiceResponse): string {
  return (response.correctedTranscript ?? response.transcript ?? '').trim();
}

function originalTranscript(response: RawVoiceResponse): string | undefined {
  const local = response.transcript?.trim();
  const english = response.correctedTranscript?.trim();
  if (local && english && local !== english) return local;
  return undefined;
}

function parseVoiceResponse(response: RawVoiceResponse, step: VoiceStep): UploadVoiceResponseResult {
  const transcript = displayTranscript(response);
  const transcriptionFailed =
    response.processingStatus === 'FAILED' ||
    (response.processingStatus === 'COMPLETED' && !transcript);

  return {
    transcript,
    originalTranscript: originalTranscript(response),
    step,
    responseId: response.uuid,
    transcriptionFailed,
    errorMessage: response.errorMessage ?? undefined,
  };
}

async function transcribeResponse(responseId: string): Promise<RawVoiceResponse> {
  const { data } = await apiClient.post<{
    success: boolean;
    data: { response: RawVoiceResponse };
  }>(`/voice-responses/${responseId}/transcribe`, {}, { timeout: 120000 });
  return data.data.response;
}

export const voiceApi = {
  createVoiceSession: async (farmerId: string): Promise<VoiceSession> => {
    const { data } = await apiClient.post<{ success: boolean; data: { session: RawVoiceSession } }>(
      `/farmers/${farmerId}/voice-sessions`,
      {}
    );
    return mapSession(data.data.session);
  },

  uploadVoiceResponse: async (
    sessionId: string,
    payload: { audioBlob: Blob; step: VoiceStep; language: string }
  ): Promise<UploadVoiceResponseResult> => {
    const language = normalizeVoiceLanguage(payload.language);

    let uploadBlob: Blob = payload.audioBlob;
    let uploadName = `recording-${payload.step}.webm`;
    try {
      uploadBlob = await blobToWav(payload.audioBlob);
      uploadName = `recording-${payload.step}.wav`;
    } catch {
      // Browser couldn't decode — send original blob.
    }

    const formData = new FormData();
    formData.append('audio', uploadBlob, uploadName);
    formData.append('questionType', STEP_TO_QUESTION[payload.step]);
    formData.append('language', language);

    const { data: uploadData } = await apiClient.post<{
      success: boolean;
      data: { response: RawVoiceResponse };
    }>(`/voice-sessions/${sessionId}/responses`, formData, {
      timeout: 120000,
    });

    let response = uploadData.data.response;
    let parsed = parseVoiceResponse(response, payload.step);

    if (parsed.transcriptionFailed && response.uuid) {
      try {
        response = await transcribeResponse(response.uuid);
        parsed = parseVoiceResponse(response, payload.step);
      } catch {
        // Agent can retry or type manually.
      }
    }

    return parsed;
  },

  retryTranscription: async (responseId: string): Promise<UploadVoiceResponseResult> => {
    try {
      const { data } = await apiClient.post<{
        success: boolean;
        data: { response: RawVoiceResponse };
      }>(`/voice-responses/${responseId}/retry`, {}, { timeout: 120000 });

      return parseVoiceResponse(data.data.response, 'CROP');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Speech-to-text failed. Type what the farmer said, or record again.';
      return {
        transcript: '',
        step: 'CROP',
        responseId,
        transcriptionFailed: true,
        errorMessage: message,
      };
    }
  },

  editVoiceResponse: async (
    sessionId: string,
    step: VoiceStep,
    editedTranscript: string,
    responseId?: string,
    originalTranscript?: string
  ): Promise<void> => {
    const body = originalTranscript
      ? { correctedTranscript: editedTranscript }
      : { transcript: editedTranscript };

    if (responseId) {
      await apiClient.patch(`/voice-responses/${responseId}/transcript`, body);
      return;
    }

    const questionType = STEP_TO_QUESTION[step];
    const { data } = await apiClient.get<{ success: boolean; data: { session: RawVoiceSession } }>(
      `/voice-sessions/${sessionId}`
    );
    const match = data.data.session.responses?.find((r) => r.questionType === questionType);
    if (!match?.uuid) return;

    await apiClient.patch(`/voice-responses/${match.uuid}/transcript`, body);
  },

  completeVoiceSession: async (sessionId: string): Promise<void> => {
    await apiClient.post(`/voice-sessions/${sessionId}/complete`, {});
  },
};
