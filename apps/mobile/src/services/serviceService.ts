import axios from 'axios';
import apiClient from './apiClient';

export interface ServiceModel {
  id: string;
  name: string;
  type: string;
  category: string;
  logo?: string;
  image?: string;
  description: string;
  location: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactUrl?: string | null;
  price: string;
  availability: string;
  rating?: number;
  reviews?: number;
  verified?: boolean;
  status?: "published" | "unpublished";
  createdAt?: string;
  updatedAt?: string;
}

const ADMIN_BASE_URL =
  (process.env.EXPO_PUBLIC_ADMIN_BASE_URL as string | undefined) ??
  (process.env.EXPO_PUBLIC_API_BASE_URL
    ? process.env.EXPO_PUBLIC_API_BASE_URL.replace(/:30501$/, ':30504').replace(/:4001$/, ':3001')
    : 'http://10.0.2.2:3001');

/**
 * Fetch all published services from backend
 */
export async function fetchPublishedServices(): Promise<ServiceModel[]> {
  // 1. Try Admin portal endpoint directly (where services are managed & published)
  try {
    const adminRes = await axios.get<{ success: boolean; services?: ServiceModel[]; data?: ServiceModel[] }>(
      `${ADMIN_BASE_URL}/api/services`,
      { timeout: 5000 }
    );
    const list = adminRes.data?.services || adminRes.data?.data;
    if (Array.isArray(list) && list.length > 0) {
      return list.filter((s) => s.status !== 'unpublished');
    }
  } catch (adminErr) {
    // Admin direct call failed, proceed to fallback
  }

  // 2. Try user-svc apiClient endpoint
  try {
    const response = await apiClient.get<{ success: boolean; services?: ServiceModel[]; data?: ServiceModel[] }>(
      '/api/services',
      { timeout: 5000 }
    );
    const list = response.data?.services || response.data?.data;
    if (Array.isArray(list) && list.length > 0) {
      return list.filter((s) => s.status !== 'unpublished');
    }
  } catch (apiErr) {
    // apiClient call failed
  }

  return [];
}
