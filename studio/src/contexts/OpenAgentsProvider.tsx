/**
 * 简化的 OpenAgents Provider - 专注于连接状态管理
 *
 * 职责：
 * 1. 维护单一的 HttpEventConnector 实例
 * 2. 监听和管理连接状态变化
 * 3. 提供连接状态给组件使用
 * 4. 暴露connector实例供其他组件直接使用
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { HttpEventConnector } from "@/services/eventConnector";
import { useAuthStore } from "@/stores/authStore";

// 简化的连接状态枚举
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

// 连接状态详情
export interface ConnectionStatus {
  state: ConnectionState;
  agentId?: string;
  originalAgentId?: string;
  isUsingModifiedId?: boolean;
  error?: string;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
}

// Context 接口
interface OpenAgentsContextType {
  // 核心connector实例
  connector: HttpEventConnector | null;

  // 连接状态
  connectionStatus: ConnectionStatus;
  isConnected: boolean;

  // 连接管理
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;

  // 错误处理
  clearError: () => void;
}

export const OpenAgentsContext = createContext<
  OpenAgentsContextType | undefined
>(undefined);

interface OpenAgentsProviderProps {
  children: ReactNode;
}

export const OpenAgentsProvider: React.FC<OpenAgentsProviderProps> = ({
  children,
}) => {
  const { agentName, selectedNetwork } = useAuthStore();
  const [connector, setConnector] = useState<HttpEventConnector | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: ConnectionState.DISCONNECTED,
  });

  const connectorRef = useRef<HttpEventConnector | null>(null);

  // 清理connector
  const cleanUpConnector = useCallback(() => {
    if (connectorRef.current) {
      console.log("🔧 Cleaning up OpenAgents connector");
      const connectorTemp = connectorRef.current;
      connectorRef.current = null;
      setConnector(null);

      // 重置连接状态
      setConnectionStatus({
        state: ConnectionState.DISCONNECTED,
      });

      connectorTemp.disconnect().catch((error) => {
        console.warn("Error during connector cleanup:", error);
      });
    }
  }, []);

  // 设置连接事件监听器
  const setupConnectionListeners = useCallback(
    (connector: HttpEventConnector) => {
      // 连接成功
      connector.on("connected", (data: any) => {
        console.log("✅ Connected to OpenAgents network:", data);
        setConnectionStatus({
          state: ConnectionState.CONNECTED,
          agentId: connector.getAgentId(),
          originalAgentId: connector.getOriginalAgentId(),
          isUsingModifiedId: connector.isUsingModifiedId(),
        });
      });

      // 连接断开
      connector.on("disconnected", (data: any) => {
        console.log("🔌 Disconnected from OpenAgents network:", data);
        setConnectionStatus((prev) => ({
          ...prev,
          state: ConnectionState.DISCONNECTED,
          error: undefined,
        }));
      });

      // 连接错误
      connector.on("connectionError", (data: any) => {
        console.error("❌ Connection error:", data);
        setConnectionStatus((prev) => ({
          ...prev,
          state: ConnectionState.ERROR,
          error: data.error || "Connection error",
        }));
      });

      // 重连中
      connector.on("reconnecting", (data: any) => {
        console.log("🔄 Reconnecting...", data);
        setConnectionStatus((prev) => ({
          ...prev,
          state: ConnectionState.RECONNECTING,
          reconnectAttempt: data.attempt,
          maxReconnectAttempts: data.maxAttempts,
          error: undefined,
        }));
      });

      // 重连成功
      connector.on("reconnected", (data: any) => {
        console.log("🔄 ✅ Reconnected successfully:", data);
        setConnectionStatus({
          state: ConnectionState.CONNECTED,
          agentId: connector.getAgentId(),
          originalAgentId: connector.getOriginalAgentId(),
          isUsingModifiedId: connector.isUsingModifiedId(),
          reconnectAttempt: undefined,
          maxReconnectAttempts: undefined,
        });
      });

      // 连接丢失
      connector.on("connectionLost", (data: any) => {
        console.error("💔 Connection lost:", data);
        setConnectionStatus((prev) => ({
          ...prev,
          state: ConnectionState.ERROR,
          error: data.reason || "Connection lost",
        }));
      });

      connector.on("rawEvent", (event: any) => {
        console.log(`📨 Raw event: ${event.event_name}`, event);
        // this.emit("rawEvent", event);
      });
    },
    []
  );

  // 初始化connector
  const initializeConnector = useCallback(() => {
    if (!agentName || !selectedNetwork?.host || !selectedNetwork?.port) {
      console.log("🔧 Missing connection parameters:", {
        agentName,
        host: selectedNetwork?.host,
        port: selectedNetwork?.port,
      });
      return;
    }

    console.log("🔧 Initializing OpenAgents connector...", {
      agentId: agentName,
      host: selectedNetwork.host,
      port: selectedNetwork.port,
    });

    const newConnector = new HttpEventConnector({
      agentId: agentName,
      host: selectedNetwork.host,
      port: selectedNetwork.port,
    });

    // 设置连接状态监听器
    setupConnectionListeners(newConnector);

    connectorRef.current = newConnector;
    setConnector(newConnector);

    // 自动连接
    newConnector.connect().catch((error) => {
      console.error("Auto-connect failed:", error);
      setConnectionStatus((prev) => ({
        ...prev,
        state: ConnectionState.ERROR,
        error: `Auto-connect failed: ${error.message}`,
      }));
    });
  }, [
    agentName,
    selectedNetwork?.host,
    selectedNetwork?.port,
    setupConnectionListeners,
  ]);

  // 初始化和清理
  useEffect(() => {
    cleanUpConnector();
    initializeConnector();
  }, [cleanUpConnector, initializeConnector]);

  useEffect(() => {
    return () => {
      cleanUpConnector();
    };
  }, [cleanUpConnector]);

  // API 方法
  const connect = useCallback(async (): Promise<boolean> => {
    if (!connector) {
      console.warn("No connector available for connection");
      return false;
    }

    setConnectionStatus((prev) => ({
      ...prev,
      state: ConnectionState.CONNECTING,
      error: undefined,
    }));

    try {
      const success = await connector.connect();
      if (!success) {
        setConnectionStatus((prev) => ({
          ...prev,
          state: ConnectionState.ERROR,
          error: "Failed to connect to OpenAgents network",
        }));
      }
      return success;
    } catch (error: any) {
      console.error("Connect error:", error);
      setConnectionStatus((prev) => ({
        ...prev,
        state: ConnectionState.ERROR,
        error: error.message || "Connection error",
      }));
      return false;
    }
  }, [connector]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!connector) return;

    try {
      await connector.disconnect();
    } catch (error: any) {
      console.error("Disconnect error:", error);
    }
  }, [connector]);

  const clearError = useCallback(() => {
    setConnectionStatus((prev) => ({
      ...prev,
      error: undefined,
    }));
  }, []);

  const isConnected = connectionStatus.state === ConnectionState.CONNECTED;

  const value: OpenAgentsContextType = {
    connector,
    connectionStatus,
    isConnected,
    connect,
    disconnect,
    clearError,
  };

  return (
    <OpenAgentsContext.Provider value={value}>
      {children}
    </OpenAgentsContext.Provider>
  );
};

export const useOpenAgents = (): OpenAgentsContextType => {
  const context = useContext(OpenAgentsContext);
  if (context === undefined) {
    throw new Error("useOpenAgents must be used within an OpenAgentsProvider");
  }
  return context;
};
