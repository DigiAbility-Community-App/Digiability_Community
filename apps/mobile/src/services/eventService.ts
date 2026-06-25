import apiClient from './apiClient';

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
