import apiClient from './api-client';
import type { User } from '../store/authStore';

interface RawUser {
  uuid: string;
  name: string;
  email: string;
  phone?: string | null;
  role: User['role'];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

function mapAuthUser(raw: RawUser): User {
  return {
    _id: raw.uuid,
    name: raw.name,
    phone: raw.phone ?? raw.email,
    role: raw.role,
  };
}

interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: RawUser;
  };
}

interface MeResponse {
  success: boolean;
  data: {
    user: RawUser;
  };
}

interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
}

export const authApi = {
  registerBuyer: async (payload: { name: string; email: string; password: string; phone?: string }) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
    return {
      ...data,
      data: { token: data.data.token, user: mapAuthUser(data.data.user) },
    };
  },

  login: async (payload: { email: string; password: string }) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return {
      ...data,
      data: { token: data.data.token, user: mapAuthUser(data.data.user) },
    };
  },

  getMe: async () => {
    const { data } = await apiClient.get<MeResponse>('/auth/me');
    return {
      ...data,
      data: { user: mapAuthUser(data.data.user) },
    };
  },
};

export type { AuthResponse, MeResponse, ErrorResponse };
