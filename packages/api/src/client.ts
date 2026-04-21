import axios, { AxiosInstance, AxiosError } from 'axios';

// Create axios instance with base configuration
const createApiClient = (baseURL: string): AxiosInstance => {
  return axios.create({
    baseURL,
    withCredentials: true, // Include cookies for HTTP-only tokens
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

// Export default client (will be configured on app startup)
export const apiClient = createApiClient(
  process.env.REACT_APP_API_URL || 
  process.env.EXPO_PUBLIC_API_URL || 
  'http://localhost:3001'
);

// Helper to set auth token
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Helper to handle errors
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
};

export default apiClient;
