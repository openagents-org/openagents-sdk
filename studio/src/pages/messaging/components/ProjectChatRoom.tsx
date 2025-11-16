/**
 * Project Private Chat Room Component
 * 
 * A dedicated chat room component for project messaging that maintains
 * the same style and functionality as the regular chat room.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams } from "react-router-dom";
import { useOpenAgents } from "@/context/OpenAgentsProvider";
import MessageRenderer from "./MessageRenderer";
import MessageInput from "./MessageInput";
import { useThemeStore } from "@/stores/themeStore";
import { CONNECTED_STATUS_COLOR } from "@/constants/chatConstants";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { UnifiedMessage } from "@/types/message";

interface ProjectChatRoomProps {
  channelName?: string;
  projectId?: string;
}

const ProjectChatRoom: React.FC<ProjectChatRoomProps> = ({
  channelName: propChannelName,
  projectId: propProjectId,
}) => {
  const { agentName } = useAuthStore();
  const { theme: currentTheme } = useThemeStore();
  
  // 使用新的 OpenAgents context
  const { connector, connectionStatus, isConnected } = useOpenAgents();

  // 从路由参数中获取 projectId（优先使用路由参数）
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  
  // 优先使用路由参数，如果没有则使用 props
  const projectId = routeProjectId || propProjectId;
  
  // 如果没有提供 channelName，根据 projectId 生成（需要从后端获取完整信息）
  // 但为了保持独立，我们先尝试从 project.get 获取信息
  const [projectInfo, setProjectInfo] = useState<{ channelName?: string; name?: string } | null>(null);
  
  // 如果没有提供 channelName，尝试从项目信息获取
  const channelName = propChannelName || projectInfo?.channelName || (projectId ? `project-${projectId}` : null);

  // 项目私密聊天室独立维护消息列表，不依赖messaging服务
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef<number>(0);
  const prevScrollHeight = useRef<number>(0);

  // 从后端获取项目信息以获取正确的 channelName
  useEffect(() => {
    const loadProjectInfo = async () => {
      if (!projectId || !connector || !isConnected) return;
      
      try {
        const agentId = connectionStatus.agentId || connector.getAgentId();
        const response = await connector.sendEvent({
          event_name: "project.get",
          source_id: agentId,
          destination_id: "mod:openagents.mods.workspace.project",
          payload: {
            project_id: projectId,
          },
        });
        
        if (response.success && response.data?.project) {
          const project = response.data.project;
          setProjectInfo({
            channelName: project.channel_name || `project-${project.template_id || 'unknown'}-${projectId}`,
            name: project.name,
          });
        }
      } catch (error) {
        console.error("Failed to load project info:", error);
        // 即使加载失败，也使用默认的 channelName
        if (!propChannelName) {
          setProjectInfo({
            channelName: `project-${projectId}`,
          });
        }
      }
    };
    
    // 只有在没有提供 channelName 时才加载项目信息
    if (!propChannelName && projectId) {
      loadProjectInfo();
    }
  }, [projectId, connector, isConnected, connectionStatus.agentId, propChannelName]);

  // 监听项目消息通知 - 项目私密聊天室通过project mod的事件接收消息
  useEffect(() => {
    if (!isConnected || !connector) return;

    const handleProjectMessage = (event: any) => {
      // 监听 project.notification.message_received 事件
      if (event.event_name === "project.notification.message_received") {
        const messageData = event.payload || {};
        const eventProjectId = messageData.project_id;
        
        if (eventProjectId === projectId) {
          console.log(`📨 Received project message for ${projectId}:`, messageData);
          
          // 将项目消息转换为UnifiedMessage格式
          const messageId = messageData.message_id || `project-msg-${Date.now()}`;
          let messageContent = messageData.content?.message || messageData.content?.text || "";
          
          // 添加附件信息到消息内容中（如果有附件）
          if (messageData.attachments && Array.isArray(messageData.attachments) && messageData.attachments.length > 0) {
            const attachmentNames = messageData.attachments.map((att: any) => att.filename || att.file_id).join(", ");
            messageContent += messageContent 
              ? ` 📎 ${attachmentNames}`
              : `📎 ${attachmentNames}`;
          }
          
          const unifiedMessage: UnifiedMessage = {
            id: messageId,
            senderId: messageData.sender_id || "",
            content: messageContent,
            timestamp: String(messageData.timestamp || Date.now()),
            type: "channel_message",
            channel: channelName,
          };
          
          // 检查是否有临时的乐观消息需要替换，或是否已存在该消息
          setMessages((prev) => {
            // 检查消息是否已存在（避免重复）
            const messageExists = prev.some(msg => msg.id === unifiedMessage.id);
            if (messageExists) {
              return prev; // 消息已存在，不重复添加
            }
            
            // 移除临时消息（如果有相同内容的临时消息）
            const filtered = prev.filter((msg) => {
              // 如果消息ID是临时的，且发送者和内容匹配，则移除
              if (msg.id.startsWith("temp-") && 
                  msg.senderId === unifiedMessage.senderId &&
                  msg.content === unifiedMessage.content) {
                return false;
              }
              return true;
            });
            
            // 添加真实消息
            return [...filtered, unifiedMessage];
          });
        }
      }
    };

    // 注册事件监听器
    connector.on("rawEvent", handleProjectMessage);

    return () => {
      connector.off("rawEvent", handleProjectMessage);
    };
  }, [isConnected, connector, projectId, channelName, connectionStatus.agentId]);

  // 智能自动滚动：只有当用户已经在底部附近时才滚动到底部
  useEffect(() => {
    const container = messagesContainerRef.current;
    const messagesEnd = messagesEndRef.current;

    if (!container || !messagesEnd) return;

    // 检查是否有新消息被添加
    const isNewMessage = messages.length > (prevMessagesLength.current ?? 0);
    const currentScrollHeight = container.scrollHeight;
    const previousScrollHeight = prevScrollHeight.current || 0;

    prevMessagesLength.current = messages.length;
    prevScrollHeight.current = currentScrollHeight;

    if (isNewMessage) {
      // 对于新消息，需要检查用户在新内容添加之前是否在底部附近
      const { scrollTop, clientHeight } = container;
      const originalDistanceFromBottom = previousScrollHeight - scrollTop - clientHeight;
      const isNearBottom = originalDistanceFromBottom < 100;

      if (isNearBottom) {
        // 用户之前就在底部附近，自动滚动到新消息
        messagesEnd.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // 不是新消息（例如初始加载、频道切换），总是滚动到底部
      messagesEnd.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 项目私密聊天室不加载历史消息，只显示实时接收的消息
  // 如果需要历史消息，可以通过project.get接口获取

  // 监听项目完成通知
  useEffect(() => {
    if (!isConnected || !connector) return;

    const handleProjectCompletion = (event: any) => {
      // 监听 project.notification.completed 事件
      if (event.event_name === "project.notification.completed") {
        const projectData = event.payload || {};
        const eventProjectId = projectData.project_id;
        const summary = projectData.summary || "Project completed";

        if (eventProjectId === projectId) {
          console.log(`🎉 Project ${projectId} completed: ${summary}`);
          toast.success(`Project completed`, {
            description: summary,
            duration: 10000,
          });
        }
      }
    };

    // 注册事件监听器
    connector.on("rawEvent", handleProjectCompletion);

    return () => {
      connector.off("rawEvent", handleProjectCompletion);
    };
  }, [isConnected, connector, projectId]);

  // 发送消息处理
  const handleSendMessage = useCallback(
    async (
      content: string,
      attachmentData?: {
        file_id: string;
        filename: string;
        size: number;
      }
    ) => {
      if ((!content.trim() && !attachmentData) || sendingMessage || !connector) return;

      console.log("📤 Sending project message:", {
        content,
        projectId,
        channelName,
        attachment: attachmentData,
      });
      setSendingMessage(true);

      try {
        const agentId = connectionStatus.agentId || connector.getAgentId();
        
        // 构建 payload
        const payload: any = {
          project_id: projectId,
          content: {
            type: "text",
            message: content.trim() || "",
          },
        };

        // 添加附件（如果有）
        if (attachmentData) {
          payload.attachments = [
            {
              file_id: attachmentData.file_id,
              filename: attachmentData.filename,
              size: attachmentData.size,
            },
          ];
        }

        // 使用 project.message.send 发送消息
        const messageResponse = await connector.sendEvent({
          event_name: "project.message.send",
          source_id: agentId,
          destination_id: "mod:openagents.mods.workspace.project",
          payload,
        });

        if (messageResponse.success) {
          console.log("✅ Project message sent", { 
            projectId, 
            messageId: messageResponse.data?.message_id 
          });
          
          // 立即添加乐观消息到列表（实时反馈）
          const agentId = connectionStatus.agentId || connector.getAgentId();
          let messageContent = content.trim();
          if (attachmentData) {
            messageContent += messageContent 
              ? ` 📎 ${attachmentData.filename}`
              : `📎 ${attachmentData.filename}`;
          }
          const optimisticMessage: UnifiedMessage = {
            id: `temp-${Date.now()}`,
            senderId: agentId,
            content: messageContent,
            timestamp: String(Date.now()),
            type: "channel_message",
            channel: channelName,
          };
          
          setMessages((prev) => [...prev, optimisticMessage]);
          
          // 消息会通过project.notification.message_received事件自动更新
        } else {
          throw new Error(messageResponse.message || "Failed to send project message");
        }
      } catch (error: any) {
        console.error("Failed to send project message:", error);
        toast.error(`Failed to send message: ${error.message || "Unknown error"}`);
      } finally {
        setSendingMessage(false);
      }
    },
    [
      sendingMessage,
      connector,
      projectId,
      channelName,
      connectionStatus.agentId,
    ]
  );

  // 获取连接状态颜色
  const getConnectionStatusColor = useMemo(() => {
    return (
      CONNECTED_STATUS_COLOR[connectionStatus.state] ||
      CONNECTED_STATUS_COLOR["default"]
    );
  }, [connectionStatus.state]);

  // 清除错误的函数
  const clearError = useCallback(() => {
    setMessagesError(null);
  }, []);

  // 按时间戳排序消息
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const parseTimestamp = (timestamp: string | number): number => {
        if (!timestamp) return 0;

        const timestampStr = String(timestamp);

        // 处理 ISO 字符串格式 (例如 '2025-09-22T20:20:09.000Z')
        if (timestampStr.includes("T") || timestampStr.includes("-")) {
          const time = new Date(timestampStr).getTime();
          return isNaN(time) ? 0 : time;
        }

        // 处理 Unix 时间戳（秒或毫秒）
        const num = parseInt(timestampStr);
        if (isNaN(num)) return 0;

        // 如果时间戳看起来是秒（典型范围：10位数字）
        // 转换为毫秒。否则假设它已经是毫秒
        if (num < 10000000000) {
          return num * 1000;
        } else {
          return num;
        }
      };

      const aTime = parseTimestamp(a.timestamp);
      const bTime = parseTimestamp(b.timestamp);

      return aTime - bTime;
    });
  }, [messages]);

  // 如果没有 projectId，显示错误
  if (!projectId) {
    return (
      <div className="project-chat-room h-full flex flex-col items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p className="text-lg mb-2">Project ID Missing</p>
          <p className="text-sm">Unable to load project private chat room</p>
        </div>
      </div>
    );
  }

  return (
    <div className="project-chat-room h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="thread-header flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getConnectionStatusColor }}
            title={`Connection: ${connectionStatus.state}`}
          />
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {channelName 
                ? `#${(channelName.startsWith("#") ? channelName.slice(1) : channelName)}`
                : `Project ${projectId?.slice(0, 8)}...`}
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
              Project Chat Room
            </span>
          </div>
        </div>
      </div>

      {/* Error display */}
      {messagesError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          <span>Error: {messagesError}</span>
          <button
            onClick={clearError}
            className="ml-2 text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
          {sortedMessages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p className="text-lg mb-2">Welcome to Project Private Chat Room</p>
              <p className="text-sm">Start your first message!</p>
            </div>
          ) : (
            <>
              <MessageRenderer
                messages={sortedMessages}
                currentUserId={connectionStatus.agentId || agentName || ""}
                isDMChat={false}
                disableReactions={true}
                disableQuotes={true}
                renderMode="flat"
                onQuote={() => {
                  // Quote is not supported in project chat room
                  toast.error("Quote is not allowed in project chat room");
                }}
                onReaction={() => {
                  // Reactions are not supported in project chat room
                  toast.error("Reactions are not allowed in project chat room");
                }}
              />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <MessageInput
          agents={[]}
          onSendMessage={(
            text: string,
            _replyTo?: string,
            _quotedMessageId?: string,
            attachmentData?: {
              file_id: string;
              filename: string;
              size: number;
            }
          ) => {
            // Reply and quote are not supported in project chat room, send message directly
            handleSendMessage(text, attachmentData);
          }}
          disabled={sendingMessage || !isConnected}
          placeholder={
            sendingMessage
              ? "Sending..."
              : `Send a message in project chat room...`
          }
          currentTheme={currentTheme}
          currentChannel={channelName}
          currentAgentId={connectionStatus.agentId || agentName || ""}
          replyingTo={null}
          quotingMessage={null}
          onCancelReply={() => {}}
          onCancelQuote={() => {}}
          disableEmoji={true}
          disableMentions={true}
          disableFileUpload={false}
        />
      </div>
    </div>
  );
};

ProjectChatRoom.displayName = "ProjectChatRoom";

export default ProjectChatRoom;

