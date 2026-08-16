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

/**
 * Fetch all published services from backend
 */
export async function fetchPublishedServices(): Promise<ServiceModel[]> {
  try {
    const response = await apiClient.get<{ success: boolean; services: ServiceModel[] }>('/api/services');
    if (response.data?.success && Array.isArray(response.data.services)) {
      return response.data.services.filter(s => s.status !== 'unpublished');
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return [];
  }
}
