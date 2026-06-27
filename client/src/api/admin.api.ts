import apiClient from './api-client';
import { listingsApi, type Listing } from './listings.api';

export interface DashboardStats {
  totalFarmers: number;
  totalAgents: number;
  publishedListings: number;
  pendingListings: number;
  totalOrders: number;
  completedOrders: number;
  failedAiRequests: number;
}

export interface AdminAgent {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  farmerCount?: number;
}

export interface AIRun {
  _id: string;
  apiType: string;
  status: string;
  attemptCount: number;
  errorMessage?: string;
  relatedFarmerName?: string;
  relatedListingTitle?: string;
  createdAt: string;
}

export interface Complaint {
  _id: string;
  orderRef?: string;
  buyerName?: string;
  message: string;
  status: string;
  order?: {
    _id: string;
    status?: string;
    total?: number;
  };
  resolution?: string;
  createdAt: string;
}

interface RawStats {
  users?: { total?: number; byRole?: Record<string, number> };
  farmers?: { total?: number };
  listings?: { total?: number; byStatus?: Record<string, number> };
  orders?: { total?: number; byStatus?: Record<string, number> };
  ai?: { total?: number; byStatus?: Record<string, number> };
}

interface RawAgent {
  uuid: string;
  name: string;
  email?: string;
  phone?: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  farmerCount?: number;
  _count?: { farmers?: number };
}

interface RawAIRun {
  uuid: string;
  apiType: string;
  processingStatus: string;
  status?: string;
  attempts: number;
  errorMessage?: string | null;
  farmer?: { fullName?: string };
  listing?: { title?: string };
  createdAt: string;
}

function mapStats(raw: RawStats): DashboardStats {
  const listingsByStatus = raw.listings?.byStatus ?? {};
  const ordersByStatus = raw.orders?.byStatus ?? {};
  const aiByStatus = raw.ai?.byStatus ?? {};

  return {
    totalFarmers: raw.farmers?.total ?? 0,
    totalAgents: raw.users?.byRole?.FIELD_AGENT ?? 0,
    publishedListings: listingsByStatus.PUBLISHED ?? 0,
    pendingListings:
      (listingsByStatus.PENDING_REVIEW ?? 0) +
      (listingsByStatus.PROCESSING ?? 0) +
      (listingsByStatus.DRAFT ?? 0),
    totalOrders: raw.orders?.total ?? 0,
    completedOrders: ordersByStatus.COMPLETED ?? 0,
    failedAiRequests: aiByStatus.FAILED ?? 0,
  };
}

export const adminApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<{ success: boolean; data: RawStats }>('/admin/stats');
    return mapStats(data.data);
  },

  listAgents: async (params?: { search?: string; page?: number; limit?: number }): Promise<AdminAgent[]> => {
    const { data } = await apiClient.get<{
      success: boolean;
      data: RawAgent[];
      pagination?: { page: number; total: number };
    }>('/admin/users', { params: { ...params, role: 'FIELD_AGENT' } });
    return data.data.map((a) => ({
      _id: a.uuid,
      name: a.name,
      email: a.email,
      phone: a.phone ?? undefined,
      status: a.status,
      farmerCount: a.farmerCount ?? a._count?.farmers ?? 0,
    }));
  },

  updateAgentStatus: async (
    id: string,
    status: 'ACTIVE' | 'SUSPENDED'
  ): Promise<AdminAgent> => {
    const { data } = await apiClient.patch<{ success: boolean; data: { user: RawAgent } }>(
      `/admin/users/${id}/status`,
      { status }
    );
    const a = data.data.user;
    return {
      _id: a.uuid,
      name: a.name,
      email: a.email,
      phone: a.phone ?? undefined,
      status: a.status,
      farmerCount: a.farmerCount ?? a._count?.farmers ?? 0,
    };
  },

  listAIRuns: async (params?: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<AIRun[]> => {
    const query: Record<string, string | number | undefined> = {
      page: params?.page,
      limit: params?.limit,
    };
    if (params?.status) query.processingStatus = params.status;
    if (params?.type) query.apiType = params.type;

    const { data } = await apiClient.get<{ success: boolean; data: RawAIRun[] }>(
      '/admin/ai-runs',
      { params: query }
    );
    return data.data.map((r) => ({
      _id: r.uuid,
      apiType: r.apiType,
      status: r.status ?? r.processingStatus,
      attemptCount: r.attempts,
      errorMessage: r.errorMessage ?? undefined,
      relatedFarmerName: r.farmer?.fullName,
      relatedListingTitle: r.listing?.title,
      createdAt: r.createdAt,
    }));
  },

  listComplaints: async (): Promise<Complaint[]> => {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: unknown[] }>(
        '/admin/complaints'
      );
      return (data.data ?? []) as Complaint[];
    } catch {
      return [];
    }
  },

  resolveComplaint: async (_id: string, _resolution: string): Promise<Complaint> => {
    throw new Error('Complaints API is not available on the backend yet');
  },

  listAdminListings: async (params?: { status?: string; page?: number }): Promise<Listing[]> => {
    const { listings } = await listingsApi.listListings(params);
    return listings;
  },

  moderateListing: async (
    id: string,
    payload: { decision: 'APPROVE' | 'REJECT'; reason?: string }
  ): Promise<Listing> => {
    await apiClient.patch(`/admin/listings/${id}/moderate`, payload);
    return listingsApi.getListing(id);
  },
};
