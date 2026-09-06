import apiClient from './apiClient';

export interface EventCategory {
  id: string;
  name: string;
}

export interface EventModel {
  id: string;
  title: string;
  category: string;
  location: string;
  date: string;
  time: string | null;
  image: string;
  description: string;
  spots: number;
  buttonType: string;
  externalUrl: string;
  organizer: string;
  accessibility_tags: string;
  status?: "published" | "unpublished";
  createdAt: string;
  updatedAt: string;
}

/** Parse comma-separated accessibility_tags string into a clean array */
export function parseAccessibilityTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Fetch all events from user-svc backend
 */
export async function fetchAllEvents(): Promise<EventModel[]> {
  const response = await apiClient.get<{ success: boolean; data: EventModel[] }>('/api/events');
  return response.data.data || [];
}

/**
 * Fetch a single event details by ID from user-svc backend
 */
export async function fetchEventById(id: string): Promise<EventModel> {
  const response = await apiClient.get<{ success: boolean; data: EventModel }>(`/api/events/${id}`);
  return response.data.data;
}

/**
 * Register / count attendance for an event when redirecting to external link
 */
export async function registerForEvent(id: string): Promise<void> {
  try {
    await apiClient.post(`/api/events/${id}/register`);
  } catch {
    // Graceful fallback if offline/mock
  }
}

/**
 * Fetch active event categories (id + name) from Master Data (admin-managed).
 * Returns an empty array on failure or when master data has no active rows —
 * callers must never invent categories to fill the gap; show an empty/error
 * state instead (see EventsScreen.tsx).
 */
export async function fetchEventCategories(): Promise<EventCategory[]> {
  try {
    const response = await apiClient.get<{ success: boolean; data: EventCategory[] }>(
      '/api/master/event-categories'
    );
    return response.data.data || [];
  } catch {
    return [];
  }
}

