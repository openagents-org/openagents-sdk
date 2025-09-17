import { create } from "zustand";
import { persist } from "zustand/middleware";
import { NetworkConnection } from "@/types/connection";

interface NetworkState {
  selectedNetwork: NetworkConnection | null;
  handleNetworkSelected: (network: NetworkConnection | null) => void;
  clearNetwork: () => void;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      selectedNetwork: null,

      handleNetworkSelected: (network: NetworkConnection | null) => {
        set({ selectedNetwork: network });
      },

      clearNetwork: () => {
        set({ selectedNetwork: null });
      },
    }),
    {
      name: "network-storage", // 持久化存储的 key
      partialize: (state) => ({ selectedNetwork: state.selectedNetwork }), // 只持久化 selectedNetwork
    }
  )
);
