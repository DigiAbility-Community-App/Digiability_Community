import { create } from 'zustand';
import axios from 'axios';

// Base URL for user-svc
const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
  'http://10.0.2.2:4001';

// Base URL for Admin portal (fallback for maintenance checks)
const ADMIN_BASE_URL =
  (process.env.EXPO_PUBLIC_ADMIN_API_URL as string | undefined) ??
  'http://192.168.1.11:3001';

interface SystemState {
  isMaintenanceMode: boolean;
  isCheckingMaintenance: boolean;
  setMaintenanceMode: (inMaintenance: boolean) => void;
  checkMaintenanceStatus: () => Promise<boolean>;
}

export const useSystemStore = create<SystemState>((set) => ({
  isMaintenanceMode: false,
  isCheckingMaintenance: false,
  setMaintenanceMode: (inMaintenance) => set({ isMaintenanceMode: inMaintenance }),
  checkMaintenanceStatus: async () => {
    try {
      set({ isCheckingMaintenance: true });

      // 1. First try user-svc /api/auth/maintenance
      try {
        const res = await axios.get<{ success: boolean; inMaintenance: boolean }>(
          `${API_BASE_URL}/api/auth/maintenance`,
          { timeout: 4000 }
        );
        if (res.data && typeof res.data.inMaintenance === 'boolean') {
          const inMaintenance = res.data.inMaintenance;
          set({ isMaintenanceMode: inMaintenance });
          return inMaintenance;
        }
      } catch (userSvcErr: any) {
        // If user-svc returned 404 (e.g. live container is still the older image), fallback to admin endpoint
      }

      // 2. Fallback: check Admin /api/maintenance endpoint directly
      try {
        const adminRes = await axios.get<{ success: boolean; inMaintenance: boolean }>(
          `${ADMIN_BASE_URL}/api/maintenance`,
          { timeout: 4000 }
        );
        if (adminRes.data && typeof adminRes.data.inMaintenance === 'boolean') {
          const inMaintenance = adminRes.data.inMaintenance;
          set({ isMaintenanceMode: inMaintenance });
          return inMaintenance;
        }
      } catch (adminErr) {
        // Both unreachable or network error
      }

      return false;
    } catch {
      return false;
    } finally {
      set({ isCheckingMaintenance: false });
    }
  },
}));

