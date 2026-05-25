export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends AuthCredentials {
  fullName: string;
}
