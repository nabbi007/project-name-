import apiClient from './api-client';

export interface Complaint {
  _id: string;
  order: string;
  buyer: string;
  message: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  createdAt: string;
}

export const complaintsApi = {
  createComplaint: async (payload: { orderId: string; message: string }) => {
    const { data } = await apiClient.post<{ success: boolean; data: { complaint: Complaint } }>('/complaints', payload);
    return data;
  },
};
