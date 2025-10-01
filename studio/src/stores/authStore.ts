import { create } from "zustand";
import { persist } from "zustand/middleware";
import { NetworkConnection } from "@/types/connection";

interface ModuleState {
  enabledModules: string[];
  defaultRoute: string | null;
  modulesLoaded: boolean;
  networkId: string | null;
  networkName: string | null;
}

interface NetworkState {
  selectedNetwork: NetworkConnection | null;
  handleNetworkSelected: (network: NetworkConnection | null) => void;
  clearNetwork: () => void;
  agentName: string | null;
  setAgentName: (name: string | null) => void;
  clearAgentName: () => void;

  // Module management
  moduleState: ModuleState;
  setModules: (modules: {
    enabledModules: string[];
    defaultRoute: string;
    networkId: string;
    networkName: string;
  }) => void;
  clearModules: () => void;
  isModuleLoaded: () => boolean;
  getDefaultRoute: () => string;
  isModuleEnabled: (moduleName: string) => boolean;
}

export const useAuthStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      selectedNetwork: null,
      agentName: null,

      // Initialize module state
      moduleState: {
        enabledModules: [],
        defaultRoute: null,
        modulesLoaded: false,
        networkId: null,
        networkName: null,
      },

      handleNetworkSelected: (network: NetworkConnection | null) => {
        set({ selectedNetwork: network });
        // Clear modules when network changes
        if (network) {
          get().clearModules();
        }
      },

      setAgentName: (name: string | null) => {
        set({ agentName: name });
      },

      clearAgentName: () => {
        set({ agentName: null });
      },

      clearNetwork: () => {
        set({ selectedNetwork: null });
        get().clearModules();
      },

      // Module management actions
      setModules: (modules) => {
        set({
          moduleState: {
            enabledModules: modules.enabledModules,
            defaultRoute: modules.defaultRoute,
            modulesLoaded: true,
            networkId: modules.networkId,
            networkName: modules.networkName,
          },
        });
      },

      clearModules: () => {
        set({
          moduleState: {
            enabledModules: [],
            defaultRoute: null,
            modulesLoaded: false,
            networkId: null,
            networkName: null,
          },
        });
      },

      isModuleLoaded: () => {
        return get().moduleState.modulesLoaded;
      },

      getDefaultRoute: () => {
        const state = get().moduleState;
        return state.defaultRoute || '/profile';
      },

      isModuleEnabled: (moduleName: string) => {
        return get().moduleState.enabledModules.includes(moduleName);
      },
    }),
    {
      name: "auth-storage", // 持久化存储的 key
      partialize: (state) => ({
        selectedNetwork: state.selectedNetwork,
        agentName: state.agentName,
        moduleState: state.moduleState,
      }), // 持久化网络、代理和模块状态
    }
  )
);
