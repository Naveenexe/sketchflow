import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token if available (used in Milestone 5+)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sketchflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  database?: {
    status: string;
    serverTime?: string;
  };
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
}
