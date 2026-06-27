import apiClient from './api-client';
import { resolveMediaUrl } from './media';

export interface Listing {
  _id: string;
  farmer: {
    _id: string;
    fullName: string;
    displayName?: string;
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

export interface ListingFilters {
  crop?: string;
  region?: string;
  community?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

interface RawPublicListing {
  uuid: string;
  title?: string;
  description?: string;
  quantity?: number | string;
  availableQuantity?: number;
  unit?: string;
  pricePerUnit?: number | string;
  availableDate?: string;
  expiresAt?: string;
  region?: string;
  community?: string;
  district?: string;
  publishedAt?: string;
  createdAt?: string;
  visionDescription?: string;
  cropCategory?: { uuid?: string; name?: string; slug?: string };
  farmer?: {
    uuid: string;
    fullName: string;
    displayName?: string;
    region?: string;
    district?: string;
    community?: string;
  };
  images?: Array<{ uuid: string; imagePath?: string; isPrimary?: boolean }>;
}

function mapPublicListing(raw: RawPublicListing): Listing {
  const primary = raw.images?.find((i) => i.isPrimary) ?? raw.images?.[0];
  const farmer = raw.farmer;

  return {
    _id: raw.uuid,
    farmer: farmer
      ? {
          _id: farmer.uuid,
          fullName: farmer.fullName,
          displayName: farmer.displayName,
          community: farmer.community ?? '',
          region: farmer.region ?? '',
          district: farmer.district ?? '',
        }
      : '',
    agent: '',
    crop: raw.cropCategory?.name ?? raw.title ?? '',
    quantity: Number(raw.quantity ?? 0),
    unit: raw.unit ?? '',
    pricePerUnit: Number(raw.pricePerUnit ?? 0),
    availableDate: raw.availableDate ?? '',
    expiryDate: raw.expiresAt,
    description: raw.description,
    region: raw.region ?? farmer?.region ?? '',
    district: raw.district ?? farmer?.district ?? '',
    community: raw.community ?? farmer?.community ?? '',
    imageUrl: resolveMediaUrl(primary?.imagePath) ?? undefined,
    visionObservation: raw.visionDescription
      ? {
          description: raw.visionDescription,
          status: 'COMPLETED',
          flaggedIssues: [],
          reviewedByAgent: true,
        }
      : undefined,
    status: 'PUBLISHED',
    publishedAt: raw.publishedAt,
    createdAt: raw.createdAt ?? raw.publishedAt ?? new Date().toISOString(),
  };
}

function toListingsResponse(
  listings: Listing[],
  pagination: { page: number; total: number }
): ListingsResponse {
  return {
    success: true,
    data: {
      listings,
      page: pagination.page,
      total: pagination.total,
    },
  };
}

export const marketplaceApi = {
  listPublishedListings: async (filters: ListingFilters = {}): Promise<ListingsResponse> => {
    const params: Record<string, string | number | undefined> = {
      crop: filters.crop,
      region: filters.region,
      community: filters.community,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      search: filters.search,
      sort: filters.sort,
      page: filters.page,
      limit: filters.limit,
    };

    const { data } = await apiClient.get<{
      success: boolean;
      data: RawPublicListing[];
      pagination: { page: number; total: number; limit: number; totalPages: number };
    }>('/marketplace/listings', { params });

    const listings = data.data.map(mapPublicListing);
    return toListingsResponse(listings, data.pagination);
  },

  getListing: async (id: string): Promise<ListingResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: { listing: RawPublicListing } }>(
      `/marketplace/listings/${id}`
    );
    return {
      success: data.success,
      data: { listing: mapPublicListing(data.data.listing) },
    };
  },

  getFarmerProfile: async (farmerId: string): Promise<{
    success: boolean;
    data: {
      farmer: {
        uuid: string;
        fullName: string;
        displayName?: string;
        region?: string;
        district?: string;
        community?: string;
      };
      listings: Listing[];
    };
  }> => {
    const { data } = await apiClient.get<{
      success: boolean;
      data: {
        farmer: {
          uuid: string;
          fullName: string;
          displayName?: string;
          region?: string;
          district?: string;
          community?: string;
        };
        listings: RawPublicListing[];
      };
    }>(`/marketplace/farmers/${farmerId}`);

    return {
      success: data.success,
      data: {
        farmer: data.data.farmer,
        listings: data.data.listings.map(mapPublicListing),
      },
    };
  },
};
