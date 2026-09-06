import axios from 'axios';
import apiClient from './apiClient';

export type DayKey =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

/** "HH:MM" 24h from/to, only meaningful when open. */
export type DaySchedule = { open: boolean; from: string; to: string };

/** Structured weekly hours set by the admin — `availability` below is the
 *  server-derived display string computed from this, e.g. "Mon–Fri:
 *  9:00 AM–6:00 PM · Sat–Sun: Closed". Rendered directly in the expandable
 *  per-day breakdown on ServicesScreen (see DAYS/formatDaySchedule below). */
export type WeeklySchedule = Record<DayKey, DaySchedule>;

/** Monday→Sunday display ordering — mirrors apps/admin/lib/availabilitySchedule.ts's
 *  DAYS constant. Duplicated here (rather than imported) because mobile and
 *  admin are separate apps/bundles. */
export const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

/** "14:00" (24h) -> "2:00 PM". Falls back to the raw string if unparseable. */
function formatDayTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return hhmm;
  const h = parseInt(m[1], 10);
  const min = m[2];
  return `${h % 12 || 12}:${min} ${h >= 12 ? "PM" : "AM"}`;
}

/** Renders a single day's schedule as "9:00 AM – 6:00 PM" or "Closed". */
export function formatDaySchedule(day: DaySchedule | null | undefined): string {
  if (!day || !day.open || !day.from || !day.to) return "Closed";
  return `${formatDayTime(day.from)} – ${formatDayTime(day.to)}`;
}

export interface ServiceCategory {
  id: string;
  name: string;
}

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
 * Fetch active service categories (id + name) from Master Data (admin-managed).
 * Returns an empty array on failure or when master data has no active rows —
 * callers must never invent categories to fill the gap; show an empty/error
 * state instead (see ServicesScreen.tsx).
 */
export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  try {
    const response = await apiClient.get<{ success: boolean; data: ServiceCategory[] }>(
      '/api/master/service-categories'
    );
    return response.data.data || [];
  } catch {
    return [];
  }
}
