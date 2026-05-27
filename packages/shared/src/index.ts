export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  identity_verified: boolean;
  reputation_score: number;
  role: 'citizen' | 'admin';
  created_at: Date;
  updated_at: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  id_card_base64: string;
}

export interface VerifyIdentityRequest {
  id_card_base64: string;
}

export interface VerifyIdentityResponse {
  verified: boolean;
  ciHash: string;
  message: string;
}
