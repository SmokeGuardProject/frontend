import { apiClient } from '@/shared/api/client';
import type {
  AuthCredentials,
  AuthResponse,
  RegisterPayload,
  UserProfile,
} from '@/features/auth/model/auth.types';

export const authApi = {
  async login(payload: AuthCredentials) {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  async register(payload: RegisterPayload) {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
    return data;
  },

  async getProfile() {
    const { data } = await apiClient.get<UserProfile>('/auth/profile');
    return data;
  },
};
