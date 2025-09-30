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
import { useNavigate, useLocation } from "react-router-dom";
import { HttpEventConnector } from "@/services/eventConnector";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { eventRouter } from "@/services/eventRouter";
import { notificationService } from "@/services/notificationService";

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
  const { selectChannel, selectDirectMessage } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [connector, setConnector] = useState<HttpEventConnector | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: ConnectionState.DISCONNECTED,
  });

  const connectorRef = useRef<HttpEventConnector | null>(null);
  const globalNotificationHandlerRef = useRef<((event: any) => void) | null>(null);

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

      // Cleanup event router
      eventRouter.cleanup();

      // Cleanup global notification handler
      if (globalNotificationHandlerRef.current) {
        eventRouter.offChatEvent(globalNotificationHandlerRef.current);
        globalNotificationHandlerRef.current = null;
      }

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
        if (data.attempt === data.maxAttempts) {
          setConnectionStatus((prev) => ({
            ...prev,
            state: ConnectionState.ERROR,
            error: "Failed to reconnect",
          }));
        }
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

      // Initialize event router with this connector
      eventRouter.initialize(connector);
    },
    []
  );

  // 设置全局通知监听器（仅在非 messaging 页面时激活）
  const setupGlobalNotificationListener = useCallback(() => {
    const isMessagingPage = location.pathname === '/messaging' || location.pathname.startsWith('/messaging/');

    // 清理现有的全局监听器
    if (globalNotificationHandlerRef.current) {
      eventRouter.offChatEvent(globalNotificationHandlerRef.current);
      globalNotificationHandlerRef.current = null;
    }

    // 只在非 messaging 页面且已连接时设置全局通知监听器
    if (!isMessagingPage && connectionStatus.state === ConnectionState.CONNECTED) {
      console.log("🔔 Setting up global notification listener (not on messaging page)");

      const globalNotificationHandler = (event: any) => {
        console.log("🔔 Global notification handler received event:", event.event_name, event);

        // 处理频道消息通知
        if (event.event_name === "thread.channel_message.notification" && event.payload) {
          const messageData = event.payload;
          if (messageData.channel && messageData.content) {
            const senderName = event.sender_id || event.source_id || "未知用户";
            const content = typeof messageData.content === 'string'
              ? messageData.content
              : messageData.content.text || "";

            notificationService.showChatNotification(
              senderName,
              messageData.channel,
              content,
              messageData.message_type
            );
          }
        }

        // 处理回复消息通知
        else if (event.event_name === "thread.reply.notification" && event.payload) {
          const messageData = event.payload;
          if (messageData.channel && messageData.content) {
            const senderName = messageData.original_sender || event.source_id || "未知用户";
            const content = typeof messageData.content === 'string'
              ? messageData.content
              : messageData.content.text || "";

            // 检查是否是回复当前用户的消息
            const currentUserId = connectionStatus.agentId || agentName;
            if (messageData.reply_to_id && currentUserId && messageData.original_sender !== currentUserId) {
              notificationService.showReplyNotification(
                senderName,
                messageData.channel,
                content
              );
            } else {
              // 普通回复消息通知
              notificationService.showChatNotification(
                senderName,
                messageData.channel,
                content,
                messageData.message_type
              );
            }
          }
        }

        // 处理私信消息通知
        else if (event.event_name === "thread.direct_message.notification" && event.payload) {
          const messageData = event.payload;
          if (messageData.content) {
            const senderName = event.source_id || messageData.sender_id || "未知用户";
            const content = typeof messageData.content === 'string'
              ? messageData.content
              : messageData.content.text || "";

            notificationService.showDirectMessageNotification(senderName, content);
          }
        }
      };

      globalNotificationHandlerRef.current = globalNotificationHandler;
      eventRouter.onChatEvent(globalNotificationHandler);
    } else if (isMessagingPage) {
      console.log("🔔 On messaging page, global notification listener disabled (chatStore handles notifications)");
    }
  }, [location.pathname, connectionStatus.state, connectionStatus.agentId, agentName]);

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

  // 监听路由变化和连接状态，自动设置/清理全局通知监听器
  useEffect(() => {
    setupGlobalNotificationListener();
  }, [setupGlobalNotificationListener]);

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

  // 全局通知点击处理
  const handleNotificationClick = useCallback((event: CustomEvent) => {
    const { channel, sender } = event.detail;

    console.log('🔔 Global notification clicked:', { channel, sender, currentPath: location.pathname });

    // 确保在 messaging 页面
    if (location.pathname !== '/messaging' && !location.pathname.startsWith('/messaging/')) {
      console.log('🔄 Navigating to messaging page from global handler...');
      navigate('/messaging');

      // 等待页面加载后再进行选择
      setTimeout(() => {
        if (channel) {
          console.log(`🔄 Selecting channel from global handler: ${channel}`);
          selectChannel(channel);
        } else if (sender) {
          console.log(`🔄 Selecting direct message from global handler: ${sender}`);
          selectDirectMessage(sender);
        }
      }, 100);
    } else {
      // 已经在 messaging 页面，直接选择
      if (channel) {
        console.log(`🔄 Selecting channel: ${channel}`);
        selectChannel(channel);
      } else if (sender) {
        console.log(`🔄 Selecting direct message: ${sender}`);
        selectDirectMessage(sender);
      }
    }
  }, [location.pathname, navigate, selectChannel, selectDirectMessage]);

  // 全局通知点击事件监听器
  useEffect(() => {
    const handleNotificationClickEvent = (event: Event) => {
      console.log('🔔 Notification clicked event:', event);
      handleNotificationClick(event as CustomEvent);
    };

    console.log('🔔 Setting up global notification-click listener');
    window.addEventListener('notification-click', handleNotificationClickEvent);

    return () => {
      console.log('🔔 Cleaning up global notification-click listener');
      window.removeEventListener('notification-click', handleNotificationClickEvent);
    };
  }, [handleNotificationClick]);

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
