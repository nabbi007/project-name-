import apiClient from './api-client';

// ─── Types ───────────────────────────────────────────────────
export interface Listing {
  _id: string;
  farmer: {
    _id: string;
    fullName: string;
    community: string;
    region: string;
    district: string;
  } | string;
  agent: string;
  voiceSession?: string;
  crop: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  availableDate: string;
  expiryDate?: string;
  description?: string;
  region: string;
  district: string;
  community: string;
  imageUrl?: string;
  visionObservation?: {
    description: string;
    status: 'PENDING' | 'ANALYZING' | 'COMPLETED' | 'FAILED' | 'NEEDS_HUMAN_REVIEW';
    flaggedIssues: string[];
    reviewedByAgent: boolean;
  };
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'SOLD_OUT' | 'EXPIRED' | 'REJECTED';
  rejectionReason?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface ListingsResponse {
  success: boolean;
  data: {
    listings: Listing[];
    page: number;
    total: number;
  };
}

export interface ListingResponse {
  success: boolean;
  data: {
    listing: Listing;
  };
}

// ─── Filters ─────────────────────────────────────────────────
export interface ListingFilters {
  crop?: string;
  region?: string;
  community?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}

// ─── API Functions ───────────────────────────────────────────
// These hit the same endpoints as agent side. For unauthenticated/buyer
// requests the backend automatically forces status=PUBLISHED,
// so we do NOT pass a status filter from here.

export const marketplaceApi = {
  listPublishedListings: async (filters: ListingFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.crop) params.set('crop', filters.crop);
    if (filters.region) params.set('region', filters.region);
    if (filters.community) params.set('community', filters.community);
    if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    if (filters.page) params.set('page', String(filters.page));

    const { data } = await apiClient.get<ListingsResponse>(`/listings?${params.toString()}`);
    return data;
  },

  getListing: async (id: string) => {
    const { data } = await apiClient.get<ListingResponse>(`/listings/${id}`);
    return data;
  },
};
