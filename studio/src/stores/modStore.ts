import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NetworkHealth } from '@/services/networkService';

interface ModAvailability {
  forum: boolean;
  wiki: boolean;
  lastChecked?: string;
}

interface ModStoreState {
  modAvailability: ModAvailability;
  networkHealth: NetworkHealth | null;
  setModAvailability: (availability: ModAvailability) => void;
  setNetworkHealth: (health: NetworkHealth | null) => void;
  clearModData: () => void;
}

const initialModAvailability: ModAvailability = {
  forum: false,
  wiki: false,
};

export const useModStore = create<ModStoreState>()(
  persist(
    (set) => ({
      modAvailability: initialModAvailability,
      networkHealth: null,
      
      setModAvailability: (availability: ModAvailability) => 
        set({ modAvailability: availability }),
      
      setNetworkHealth: (health: NetworkHealth | null) => {
        set({ networkHealth: health });
        if (health) {
          set({
            modAvailability: {
              forum: health.forum_available || false,
              wiki: health.wiki_available || false,
              lastChecked: health.timestamp,
            }
          });
        }
      },
      
      clearModData: () => 
        set({ 
          modAvailability: initialModAvailability, 
          networkHealth: null 
        }),
    }),
    {
      name: 'openagents-mod-store',
      // Only persist mod availability, not full health data
      partialize: (state) => ({ 
        modAvailability: state.modAvailability 
      }),
    }
  )
);