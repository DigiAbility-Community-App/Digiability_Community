import { create } from 'zustand';
import axios from 'axios';

// Base URL for user-svc
const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
  'http://187.127.191.28:30501';

// Base URLs for Admin portal (live remote + local fallbacks)
const ADMIN_BASE_URL =
  (process.env.EXPO_PUBLIC_ADMIN_API_URL as string | undefined) ??
  'http://187.127.191.28:30504';

interface SystemState {
  isMaintenanceMode: boolean;
  isCheckingMaintenance: boolean;
  supportPhone: string;
  supportEmail: string;
  setMaintenanceMode: (inMaintenance: boolean) => void;
  checkMaintenanceStatus: () => Promise<boolean>;
}

export const useSystemStore = create<SystemState>((set) => ({
  isMaintenanceMode: false,
  isCheckingMaintenance: false,
  supportPhone: '+91 88000 12345',
  supportEmail: 'support@digiability.org',
  setMaintenanceMode: (inMaintenance) => set({ isMaintenanceMode: inMaintenance }),
  checkMaintenanceStatus: async () => {
    try {
      set({ isCheckingMaintenance: true });

      let foundSupportInfo = false;
      let maintenanceResult = false;

      // 1. Check Admin API endpoint first for direct live settings
      const adminEndpoints = [
        `${ADMIN_BASE_URL}/api/maintenance`,
        'http://187.127.191.28:30504/api/maintenance',
        'http://192.168.1.11:3001/api/maintenance',
        'http://localhost:3001/api/maintenance',
        'http://10.0.2.2:3001/api/maintenance',
      ];

      for (const endpoint of adminEndpoints) {
        try {
          const adminRes = await axios.get<{
            success: boolean;
            inMaintenance: boolean;
            supportPhone?: string;
            supportEmail?: string;
          }>(endpoint, { timeout: 2500 });

          if (adminRes.data && adminRes.data.success) {
            maintenanceResult = Boolean(adminRes.data.inMaintenance);
            set({
              isMaintenanceMode: maintenanceResult,
              ...(adminRes.data.supportPhone ? { supportPhone: adminRes.data.supportPhone } : {}),
              ...(adminRes.data.supportEmail ? { supportEmail: adminRes.data.supportEmail } : {}),
            });
            foundSupportInfo = true;
            break;
          }
        } catch {
          // Try next endpoint
        }
      }

      // 2. Also check user-svc /api/auth/maintenance
      try {
        const res = await axios.get<{
          success: boolean;
          inMaintenance: boolean;
          supportPhone?: string;
          supportEmail?: string;
        }>(`${API_BASE_URL}/api/auth/maintenance`, { timeout: 3000 });

        if (res.data && typeof res.data.inMaintenance === 'boolean') {
          maintenanceResult = res.data.inMaintenance;
          set({
            isMaintenanceMode: maintenanceResult,
            ...(res.data.supportPhone ? { supportPhone: res.data.supportPhone } : {}),
            ...(res.data.supportEmail ? { supportEmail: res.data.supportEmail } : {}),
          });
        }
      } catch {
        // user-svc unreachable
      }

      return maintenanceResult;
    } catch {
      return false;
    } finally {
      set({ isCheckingMaintenance: false });
    }
  },
}));
