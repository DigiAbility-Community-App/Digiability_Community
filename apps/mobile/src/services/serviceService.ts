import axios from 'axios';
import apiClient from './apiClient';

export type DayKey =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

/** "HH:MM" 24h from/to, only meaningful when open. */
export type DaySchedule = { open: boolean; from: string; to: string };

/** Structured weekly hours set by the admin — `availability` below is the
 *  server-derived display string computed from this, e.g. "Mon–Fri:
 *  9:00 AM–6:00 PM · Sat–Sun: Closed". Not currently rendered directly here;
 *  kept on the type so it round-trips and is available if a screen wants
 *  the structured form later. */
export type WeeklySchedule = Record<DayKey, DaySchedule>;

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
  availabilitySchedule?: WeeklySchedule | null;
  rating?: number;
  reviews?: number;
  verified?: boolean;
  status?: "published" | "unpublished";
  createdAt?: string;
  updatedAt?: string;
}

const ADMIN_BASE_URL =
  // .env/.env.example/eas.json all define EXPO_PUBLIC_ADMIN_API_URL — this
  // previously read a differently-named var that was never set anywhere,
  // so it silently always fell through to the derived guess below.
  (process.env.EXPO_PUBLIC_ADMIN_API_URL as string | undefined) ??
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

/**
 * Fetch active service category names from Master Data (admin-managed).
 * Returns an empty array on failure — callers should fall back to a
 * hardcoded default list rather than leaving the category picker empty.
 */
export async function fetchServiceCategories(): Promise<string[]> {
  try {
    const response = await apiClient.get<{ success: boolean; data: { id: string; name: string }[] }>(
      '/api/master/service-categories'
    );
    return (response.data.data || []).map((c) => c.name);
  } catch {
    return [];
  }
}
