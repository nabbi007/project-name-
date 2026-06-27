import apiClient from './api-client';
import type { User } from '../store/authStore';

interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
  };
}

interface MeResponse {
  success: boolean;
  data: {
    user: User;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
}

export const authApi = {
  registerBuyer: async (payload: { name: string; phone: string; password: string }) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register-buyer', payload);
    return data;
  },

  login: async (payload: { phone: string; password: string }) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  getMe: async () => {
    const { data } = await apiClient.get<MeResponse>('/auth/me');
    return data;
  },
};

export type { AuthResponse, MeResponse, ErrorResponse };
