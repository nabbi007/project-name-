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

function pickTranscript(response: RawVoiceResponse): string {
  const english = (response.correctedTranscript ?? '').trim();
  if (english) return english;
  return (response.transcript ?? '').trim();
}

function pickOriginalTranscript(response: RawVoiceResponse): string | undefined {
  const original = (response.transcript ?? '').trim();
  const english = (response.correctedTranscript ?? '').trim();
  if (original && english && original !== english) return original;
  if (original && !english && response.processingStatus === 'COMPLETED') return original;
  return undefined;
}

export interface UploadVoiceResponseResult {
  transcript: string;
  originalTranscript?: string;
  step: VoiceStep;
  responseId: string;
  transcriptionFailed?: boolean;
  translationMissing?: boolean;
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
    formData.append('language', payload.language || 'en');

    const { data: uploadData } = await apiClient.post<{
      success: boolean;
      data: { response: RawVoiceResponse };
    }>(`/voice-sessions/${sessionId}/responses`, formData, {
      timeout: 120000,
    });

    const response = uploadData.data.response;
    const responseId = response.uuid;
    const originalTranscript = pickOriginalTranscript(response);
    const transcript = pickTranscript(response);
    const hasOriginal = Boolean((response.transcript ?? '').trim());
    const hasEnglish = Boolean((response.correctedTranscript ?? '').trim());
    const transcriptionFailed =
      response.processingStatus === 'FAILED' ||
      (response.processingStatus === 'COMPLETED' && !hasOriginal && !hasEnglish);
    const translationMissing =
      !transcriptionFailed && hasOriginal && !hasEnglish && Boolean(originalTranscript);

    return {
      transcript,
      originalTranscript,
      step: payload.step,
      responseId,
      transcriptionFailed,
      translationMissing,
    };
  },

  retryTranscription: async (responseId: string): Promise<UploadVoiceResponseResult> => {
    const { data } = await apiClient.post<{
      success: boolean;
      data: { response: RawVoiceResponse };
    }>(`/voice-responses/${responseId}/retry`, {}, { timeout: 120000 });

    const response = data.data.response;
    const originalTranscript = pickOriginalTranscript(response);
    const transcript = pickTranscript(response);
    const hasOriginal = Boolean((response.transcript ?? '').trim());
    const hasEnglish = Boolean((response.correctedTranscript ?? '').trim());
    const transcriptionFailed =
      response.processingStatus === 'FAILED' ||
      (response.processingStatus === 'COMPLETED' && !hasOriginal && !hasEnglish);
    const translationMissing =
      !transcriptionFailed && hasOriginal && !hasEnglish && Boolean(originalTranscript);

    return {
      transcript,
      originalTranscript,
      step: 'CROP',
      responseId: response.uuid,
      transcriptionFailed,
      translationMissing,
    };
  },

  editVoiceResponse: async (
    sessionId: string,
    step: VoiceStep,
    editedTranscript: string,
    responseId?: string
  ): Promise<void> => {
    if (responseId) {
      await apiClient.patch(`/voice-responses/${responseId}/transcript`, {
        correctedTranscript: editedTranscript,
      });
      return;
    }

    const questionType = STEP_TO_QUESTION[step];
    const { data } = await apiClient.get<{ success: boolean; data: { session: RawVoiceSession } }>(
      `/voice-sessions/${sessionId}`
    );
    const match = data.data.session.responses?.find((r) => r.questionType === questionType);
    if (!match?.uuid) return;

    await apiClient.patch(`/voice-responses/${match.uuid}/transcript`, {
      correctedTranscript: editedTranscript,
    });
  },

  /** No dedicated complete endpoint — extraction reads completed session responses. */
  completeVoiceSession: async (_sessionId: string): Promise<void> => {},
};
