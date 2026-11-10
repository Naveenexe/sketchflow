import { apiClient } from './api';
import type { AuthResponse } from '../types';

export async function registerUser(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', {
    email,
    password,
    displayName,
  });
  return response.data;
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return response.data;
}

export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Stateless JWT logout; ignore network error during sign-out
  }
}
