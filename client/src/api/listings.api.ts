import apiClient from './api-client';
import { resolveMediaUrl } from './media';
import { blobToWav } from '../utils/audioToWav';

const PUBLISH_VOICE_FIELDS = new Set([
  'crop',
  'quantity',
  'unit',
  'pricePerUnit',
  'availableDate',
]);

/** Fields that can be collected with TTS + follow-up recording. */
export function filterVoiceGapFields(fields: string[]): string[] {
  return [...new Set(fields.map((f) => (f === 'price' ? 'pricePerUnit' : f)))].filter((f) =>
    PUBLISH_VOICE_FIELDS.has(f)
  );
}

export type VisionStatus =
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NEEDS_HUMAN_REVIEW'
  | 'PENDING';

export interface VisionObservation {
  description?: string;
  status?: VisionStatus;
  flaggedIssues?: string[];
  reviewedByAgent?: boolean;
  identifiedCrop?: string;
  cropMatchStatus?: string;
}

export interface ListingImage {
  _id: string;
  imageUrl?: string;
  status?: string;
  cropMatchStatus?: string;
  isPrimary?: boolean;
}

export interface Listing {
  _id: string;
  farmer: string;
  farmerName?: string;
  agent?: string;
  voiceSession?: string;
  crop?: string;
  cropCategoryId?: string;
  quantity?: number;
  unit?: string;
  pricePerUnit?: number;
  availableDate?: string;
  expiryDate?: string;
  description?: string;
  region?: string;
  district?: string;
  community?: string;
  imageUrl?: string;
  primaryImageId?: string;
  images?: ListingImage[];
  visionObservation?: VisionObservation;
  agentConfirmed?: boolean;
  status?: string;
  rejectionReason?: string;
  publishedAt?: string;
  createdAt?: string;
}

export interface ListingFormPayload {
  crop?: string;
  quantity?: number;
  unit?: string;
  pricePerUnit?: number;
  availableDate?: string;
  expiryDate?: string;
  description?: string;
  region?: string;
  district?: string;
  community?: string;
  agentConfirmed?: boolean;
}

export interface GeneratedAudio {
  _id: string;
  audioUrl: string;
  textContent?: string;
  processingStatus?: string;
}

interface RawImage {
  uuid: string;
  imagePath?: string;
  status?: string;
  cropMatchStatus?: string;
  isPrimary?: boolean;
  visionResponse?: string | null;
}

interface RawListing {
  uuid?: string;
  _id?: string;
  farmer?: string | { uuid: string; fullName?: string; community?: string; region?: string };
  fieldAgent?: string | { uuid: string };
  voiceSession?: string | { uuid: string };
  title?: string;
  crop?: string;
  cropCategory?: { uuid?: string; name?: string };
  quantity?: number | string;
  unit?: string;
  pricePerUnit?: number | string;
  availableDate?: string;
  expiresAt?: string;
  expiryDate?: string;
  description?: string;
  region?: string;
  district?: string;
  community?: string;
  imageUrl?: string;
  images?: RawImage[];
  visionObservation?: VisionObservation;
  visualObservation?: string;
  visionDescription?: string;
  agentConfirmed?: boolean;
  status?: string;
  rejectionReason?: string;
  publishedAt?: string;
  createdAt?: string;
}

interface VisionObservationPayload {
  identifiedCrop?: string;
  colour?: string;
  maturity?: string;
  visibleCondition?: string;
  visibleIssues?: string[];
  recommendation?: string;
  warning?: string;
}

function imageStatusToVision(status?: string, cropMatch?: string): VisionStatus {
  if (status === 'PENDING') return 'PENDING';
  if (status === 'ANALYSED') {
    if (cropMatch === 'MANUAL_REVIEW_REQUIRED' || cropMatch === 'MISMATCH' || cropMatch === 'UNCLEAR') {
      return 'NEEDS_HUMAN_REVIEW';
    }
    return 'COMPLETED';
  }
  if (status === 'REVIEWED') return 'COMPLETED';
  if (status === 'REJECTED') return 'FAILED';
  return 'PENDING';
}

function formatObservation(obs?: VisionObservationPayload, fallback?: string): string | undefined {
  if (fallback) return fallback;
  if (!obs) return undefined;
  const parts: string[] = [];
  if (obs.identifiedCrop) parts.push(`Crop: ${obs.identifiedCrop}`);
  if (obs.colour) parts.push(`Colour: ${obs.colour}`);
  if (obs.maturity) parts.push(`Maturity: ${obs.maturity}`);
  if (obs.visibleCondition) parts.push(`Condition: ${obs.visibleCondition}`);
  if (obs.visibleIssues?.length) parts.push(`Issues: ${obs.visibleIssues.join(', ')}`);
  if (obs.recommendation) parts.push(obs.recommendation);
  if (obs.warning) parts.push(`Note: ${obs.warning}`);
  return parts.length ? parts.join('. ') : undefined;
}

function parseVisionFromImage(image?: RawImage, listing?: RawListing): VisionObservation | undefined {
  if (!image && !listing?.visionDescription && !listing?.visualObservation) return undefined;

  let parsed: VisionObservationPayload | undefined;
  if (image?.visionResponse) {
    try {
      parsed = JSON.parse(image.visionResponse) as VisionObservationPayload;
    } catch {
      parsed = { recommendation: image.visionResponse };
    }
  }

  const description =
    formatObservation(parsed, listing?.visionDescription ?? listing?.visualObservation) ??
    parsed?.recommendation;

  return {
    description,
    status: imageStatusToVision(image?.status, image?.cropMatchStatus),
    flaggedIssues: parsed?.visibleIssues ?? [],
    reviewedByAgent: image?.status === 'REVIEWED',
    identifiedCrop: parsed?.identifiedCrop,
    cropMatchStatus: image?.cropMatchStatus,
  };
}

function mapListing(raw: RawListing): Listing {
  const farmerObj = typeof raw.farmer === 'object' ? raw.farmer : undefined;
  const images: ListingImage[] = (raw.images ?? []).map((img) => ({
    _id: img.uuid,
    imageUrl: resolveMediaUrl(img.imagePath) ?? undefined,
    status: img.status,
    cropMatchStatus: img.cropMatchStatus,
    isPrimary: img.isPrimary,
  }));

  const primary = images.find((i) => i.isPrimary) ?? images[0];
  const primaryRaw = raw.images?.find((i) => i.uuid === primary?._id) ?? raw.images?.[0];

  return {
    _id: raw.uuid ?? raw._id ?? '',
    farmer: farmerObj?.uuid ?? (typeof raw.farmer === 'string' ? raw.farmer : ''),
    farmerName: farmerObj?.fullName,
    agent: typeof raw.fieldAgent === 'object' ? raw.fieldAgent.uuid : raw.fieldAgent,
    voiceSession:
      typeof raw.voiceSession === 'object' ? raw.voiceSession.uuid : raw.voiceSession,
    crop: raw.cropCategory?.name ?? raw.crop ?? raw.title,
    cropCategoryId: raw.cropCategory?.uuid,
    quantity: raw.quantity != null ? Number(raw.quantity) : undefined,
    unit: raw.unit,
    pricePerUnit: raw.pricePerUnit != null ? Number(raw.pricePerUnit) : undefined,
    availableDate: raw.availableDate,
    expiryDate: raw.expiryDate ?? raw.expiresAt,
    description: raw.description,
    region: raw.region ?? farmerObj?.region,
    district: raw.district,
    community: raw.community ?? farmerObj?.community,
    imageUrl: primary?.imageUrl ?? resolveMediaUrl(raw.imageUrl) ?? undefined,
    primaryImageId: primary?._id,
    images,
    visionObservation: parseVisionFromImage(primaryRaw, raw),
    agentConfirmed: raw.agentConfirmed,
    status: raw.status,
    rejectionReason: raw.rejectionReason,
    publishedAt: raw.publishedAt,
    createdAt: raw.createdAt,
  };
}

function toUpdateBody(payload: ListingFormPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { ...payload };
  if (payload.crop !== undefined) {
    body.title = payload.crop;
    delete body.crop;
  }
  if (payload.expiryDate !== undefined) {
    body.expiresAt = payload.expiryDate;
    delete body.expiryDate;
  }
  return body;
}

function mapAudio(raw: {
  uuid?: string;
  _id?: string;
  audioPath?: string;
  audioUrl?: string;
  textContent?: string;
  processingStatus?: string;
}): GeneratedAudio {
  return {
    _id: raw.uuid ?? raw._id ?? '',
    audioUrl: resolveMediaUrl(raw.audioUrl ?? raw.audioPath) ?? '',
    textContent: raw.textContent,
    processingStatus: raw.processingStatus,
  };
}

async function fetchListingById(id: string): Promise<Listing> {
  const { data } = await apiClient.get<{ success: boolean; data: { listing: RawListing } }>(
    `/listings/${id}`
  );
  return mapListing(data.data.listing);
}

async function resolvePrimaryImageId(listingId: string): Promise<string | undefined> {
  const listing = await fetchListingById(listingId);
  return listing.primaryImageId;
}

export const listingsApi = {
  extractListing: async (
    voiceSessionId: string
  ): Promise<{ listing: Listing; incompleteFields: string[] }> => {
    const { data } = await apiClient.post<{
      success: boolean;
      data: { listing: RawListing; incompleteFields?: string[] };
    }>(`/voice-sessions/${voiceSessionId}/extract-listing`);
    return {
      listing: mapListing(data.data.listing),
      incompleteFields: filterVoiceGapFields(data.data.incompleteFields ?? []),
    };
  },

  updateListing: async (id: string, payload: ListingFormPayload): Promise<Listing> => {
    const { data } = await apiClient.patch<{ success: boolean; data: { listing: RawListing } }>(
      `/listings/${id}`,
      toUpdateBody(payload)
    );
    return mapListing(data.data.listing);
  },

  getListing: fetchListingById,

  uploadListingImage: async (
    id: string,
    imageFile: File,
    onProgress?: (percent: number) => void
  ): Promise<Listing> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('isPrimary', 'true');

    const { data: uploadData } = await apiClient.post<{
      success: boolean;
      data: { image: RawImage };
    }>(`/listings/${id}/images`, formData, {
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });

    const imageId = uploadData.data.image.uuid;
    await apiClient.post(`/listing-images/${imageId}/analyse`);
    return fetchListingById(id);
  },

  submitVisionReview: async (
    id: string,
    payload: { approved: boolean; explanation?: string }
  ): Promise<Listing> => {
    const imageId = await resolvePrimaryImageId(id);
    if (!imageId) throw new Error('No listing image to review');

    await apiClient.patch(`/listing-images/${imageId}/review`, {
      decision: payload.approved ? 'APPROVE' : 'REJECT',
      notes: payload.explanation,
    });

    if (payload.approved) {
      await apiClient.patch(`/listings/${id}`, { agentConfirmed: true });
    }

    return fetchListingById(id);
  },

  publishListing: async (id: string): Promise<Listing> => {
    const { data } = await apiClient.post<{ success: boolean; data: { listing: RawListing } }>(
      `/listings/${id}/publish`
    );
    return mapListing(data.data.listing);
  },

  unpublishListing: async (id: string): Promise<Listing> => {
    const { data } = await apiClient.post<{ success: boolean; data: { listing: RawListing } }>(
      `/listings/${id}/unpublish`
    );
    return mapListing(data.data.listing);
  },

  rejectListing: async (id: string, reason: string): Promise<Listing> => {
    const { data } = await apiClient.patch<{ success: boolean; data: { listing: RawListing } }>(
      `/admin/listings/${id}/moderate`,
      { decision: 'REJECT', reason }
    );
    return mapListing(data.data.listing);
  },

  generateConfirmationAudio: async (id: string, _messageType: 'PUBLISHED'): Promise<GeneratedAudio> => {
    const { data } = await apiClient.post<{
      success: boolean;
      data: {
        audio: {
          uuid?: string;
          audioPath?: string;
          textContent?: string;
          processingStatus?: string;
        };
      };
    }>(`/listings/${id}/audio`, {});
    return mapAudio(data.data.audio);
  },

  generateMissingFieldsAudio: async (
    id: string,
    fields: string[],
    language?: string
  ): Promise<GeneratedAudio> => {
    const { data } = await apiClient.post<{
      success: boolean;
      data: {
        audio: {
          uuid?: string;
          audioPath?: string;
          textContent?: string;
          processingStatus?: string;
        };
      };
    }>(`/listings/${id}/audio`, { fields, language });
    return mapAudio(data.data.audio);
  },

  supplementListingVoice: async (
    id: string,
    audioBlob: Blob,
    language?: string
  ): Promise<{ listing: Listing; incompleteFields: string[]; transcript: string; originalTranscript?: string }> => {
    const wav = await blobToWav(audioBlob);
    const form = new FormData();
    form.append('audio', wav, 'supplement.wav');
    if (language) form.append('language', language);

    const { data } = await apiClient.post<{
      success: boolean;
      data: {
        listing: RawListing;
        incompleteFields?: string[];
        transcript?: string;
        originalTranscript?: string;
      };
    }>(`/listings/${id}/supplement-voice`, form);

    return {
      listing: mapListing(data.data.listing),
      incompleteFields: filterVoiceGapFields(data.data.incompleteFields ?? []),
      transcript: data.data.transcript ?? '',
      originalTranscript: data.data.originalTranscript,
    };
  },

  ackConfirmationAudio: async (audioId: string, _payload?: { farmerHeard?: boolean; farmerConfirmed?: boolean }): Promise<void> => {
    await apiClient.patch(`/generated-audio/${audioId}/played`);
  },

  listListings: async (params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<{
    listings: Listing[];
    pagination: { page: number; totalPages: number; total: number; limit?: number };
  }> => {
    const { data } = await apiClient.get<{
      success: boolean;
      data: RawListing[];
      pagination: { page: number; totalPages: number; total: number; limit?: number };
    }>('/listings', { params });
    return {
      listings: data.data.map(mapListing),
      pagination: data.pagination,
    };
  },
};

export function isPublishBlockedError(err: unknown): boolean {
  const axiosErr = err as { response?: { status?: number; data?: { errors?: { publication?: string[] } } } };
  return (
    axiosErr.response?.status === 422 &&
    Array.isArray(axiosErr.response?.data?.errors?.publication)
  );
}

export function getPublicationBlockers(err: unknown): string[] {
  if (!isPublishBlockedError(err)) return [];
  const axiosErr = err as { response: { data: { errors: { publication: string[] } } } };
  return axiosErr.response.data.errors.publication;
}

export function getListingImageUrl(imageUrl?: string): string | null {
  return resolveMediaUrl(imageUrl);
}
