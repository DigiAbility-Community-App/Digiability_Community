import { create } from 'zustand';
import axios from 'axios';

import { API_URL as API_BASE_URL, ADMIN_API_URL as ADMIN_BASE_URL } from '@config/env';

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

      // 1. Check the Admin API first for direct live settings
      try {
        const adminRes = await axios.get<{
          success: boolean;
          inMaintenance: boolean;
          supportPhone?: string;
          supportEmail?: string;
        }>(`${ADMIN_BASE_URL}/api/maintenance`, { timeout: 2500 });

        if (adminRes.data && adminRes.data.success) {
          maintenanceResult = Boolean(adminRes.data.inMaintenance);
          set({
            isMaintenanceMode: maintenanceResult,
            ...(adminRes.data.supportPhone ? { supportPhone: adminRes.data.supportPhone } : {}),
            ...(adminRes.data.supportEmail ? { supportEmail: adminRes.data.supportEmail } : {}),
          });
          foundSupportInfo = true;
        }
      } catch {
        // Fall through to user-svc
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
