import { create } from "zustand";
import { ThreadChannel, AgentInfo, EventNames } from "../types/events";
import { UnifiedMessage, RawThreadMessage, MessageAdapter } from "../types/message";

// Chat Store 接口
interface ChatState {
  // 连接
  connection: any | null;

  // Channels 状态
  channels: ThreadChannel[];
  channelsLoading: boolean;
  channelsError: string | null;

  // Messages 状态 - 按 channel/targetAgentId 分组存储
  channelMessages: Map<string, UnifiedMessage[]>;
  directMessages: Map<string, UnifiedMessage[]>;
  messagesLoading: boolean;
  messagesError: string | null;

  // Agents 状态
  agents: AgentInfo[];
  agentsLoading: boolean;
  agentsError: string | null;

  // Actions - Connection
  setConnection: (connection: any | null) => void;

  // Actions - Channels
  loadChannels: () => Promise<void>;
  clearChannelsError: () => void;

  // Actions - Messages
  loadChannelMessages: (channel: string, limit?: number, offset?: number) => Promise<void>;
  loadDirectMessages: (targetAgentId: string, limit?: number, offset?: number) => Promise<void>;
  sendChannelMessage: (channel: string, content: string, replyToId?: string) => Promise<boolean>;
  sendDirectMessage: (targetAgentId: string, content: string) => Promise<boolean>;
  clearMessagesError: () => void;

  // Actions - Agents
  loadAgents: () => Promise<void>;
  clearAgentsError: () => void;

  // Actions - Reactions
  addReaction: (messageId: string, reactionType: string, channel?: string) => Promise<boolean>;
  removeReaction: (messageId: string, reactionType: string, channel?: string) => Promise<boolean>;

  // Real-time updates
  addMessageToChannel: (channel: string, message: UnifiedMessage) => void;
  addMessageToDirect: (targetAgentId: string, message: UnifiedMessage) => void;
  updateMessage: (messageId: string, updates: Partial<UnifiedMessage>) => void;

  // Event handling
  setupEventListeners: () => void;
  cleanupEventListeners: () => void;

  // Helper functions
  getChannelMessages: (channel: string) => UnifiedMessage[];
  getDirectMessagesForAgent: (targetAgentId: string, currentAgentId: string) => UnifiedMessage[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  connection: null,

  // Channels state
  channels: [],
  channelsLoading: false,
  channelsError: null,

  // Messages state
  channelMessages: new Map(),
  directMessages: new Map(),
  messagesLoading: false,
  messagesError: null,

  // Agents state
  agents: [],
  agentsLoading: false,
  agentsError: null,

  // Connection management
  setConnection: (connection) => {
    set({ connection });
  },

  // Channels management
  loadChannels: async () => {
    const { connection } = get();
    if (!connection) {
      console.warn("ChatStore: No connection available for loadChannels");
      set({ channelsError: "No connection available" });
      return;
    }

    console.log("ChatStore: Loading channels...");
    set({ channelsLoading: true, channelsError: null });

    try {
      const response = await connection.sendEvent({
        event_name: EventNames.THREAD_CHANNELS_LIST,
        source_id: connection.getAgentId(),
        destination_id: "mod:openagents.mods.workspace.messaging",
        payload: {},
      });

      if (response.success && response.data) {
        console.log("ChatStore: Loaded channels:", response.data.channels?.length || 0);
        set({
          channels: response.data.channels || [],
          channelsLoading: false,
        });
      } else {
        console.warn("ChatStore: Failed to load channels. Response:", response);
        set({
          channels: [],
          channelsLoading: false,
          channelsError: response.message || "Failed to load channels",
        });
      }
    } catch (error) {
      console.error("ChatStore: Failed to load channels:", error);
      set({
        channelsError: "Failed to load channels",
        channelsLoading: false,
      });
    }
  },

  clearChannelsError: () => {
    set({ channelsError: null });
  },

  // Messages management
  loadChannelMessages: async (channel: string, limit = 50, offset = 0) => {
    const { connection } = get();
    if (!connection) {
      console.warn("ChatStore: No connection available for loadChannelMessages");
      set({ messagesError: "No connection available" });
      return;
    }

    console.log(`ChatStore: Loading messages for channel #${channel}...`);
    set({ messagesLoading: true, messagesError: null });

    try {
      const response = await connection.sendEvent({
        event_name: EventNames.THREAD_CHANNEL_MESSAGES_RETRIEVE,
        source_id: connection.getAgentId(),
        destination_id: "mod:openagents.mods.workspace.messaging",
        payload: {
          channel: channel,
          limit: limit,
          offset: offset,
        },
      });

      if (response.success && response.data && response.data.messages) {
        console.log(`ChatStore: Loaded ${response.data.messages.length} messages for channel #${channel}`);

        // 转换原始消息为统一格式
        const rawMessages: RawThreadMessage[] = response.data.messages;
        const unifiedMessages = MessageAdapter.fromRawThreadMessages(rawMessages);

        // 存储到 channelMessages Map 中
        set((state) => {
          const newChannelMessages = new Map(state.channelMessages);
          newChannelMessages.set(channel, unifiedMessages);
          return {
            channelMessages: newChannelMessages,
            messagesLoading: false,
          };
        });
      } else {
        console.warn(`ChatStore: Failed to load messages for channel #${channel}. Response:`, response);
        set({
          messagesLoading: false,
          messagesError: response.message || `Failed to load messages for channel #${channel}`,
        });
      }
    } catch (error) {
      console.error(`ChatStore: Failed to load messages for channel #${channel}:`, error);
      set({
        messagesError: `Failed to load messages for channel #${channel}`,
        messagesLoading: false,
      });
    }
  },

  loadDirectMessages: async (targetAgentId: string, limit = 50, offset = 0) => {
    const { connection } = get();
    if (!connection) {
      console.warn("ChatStore: No connection available for loadDirectMessages");
      set({ messagesError: "No connection available" });
      return;
    }

    console.log(`ChatStore: Loading direct messages with ${targetAgentId}...`);
    set({ messagesLoading: true, messagesError: null });

    try {
      const response = await connection.sendEvent({
        event_name: EventNames.THREAD_DIRECT_MESSAGES_RETRIEVE,
        source_id: connection.getAgentId(),
        destination_id: "mod:openagents.mods.workspace.messaging",
        payload: {
          target_agent_id: targetAgentId,
          limit: limit,
          offset: offset,
        },
      });

      if (response.success && response.data && response.data.messages) {
        console.log(`ChatStore: Loaded ${response.data.messages.length} direct messages with ${targetAgentId}`);

        // 转换原始消息为统一格式
        const rawMessages: RawThreadMessage[] = response.data.messages;
        const unifiedMessages = MessageAdapter.fromRawThreadMessages(rawMessages);

        // 存储到 directMessages Map 中
        set((state) => {
          const newDirectMessages = new Map(state.directMessages);
          newDirectMessages.set(targetAgentId, unifiedMessages);
          return {
            directMessages: newDirectMessages,
            messagesLoading: false,
          };
        });
      } else {
        console.warn(`ChatStore: Failed to load direct messages with ${targetAgentId}. Response:`, response);
        set({
          messagesLoading: false,
          messagesError: response.message || `Failed to load direct messages with ${targetAgentId}`,
        });
      }
    } catch (error) {
      console.error(`ChatStore: Failed to load direct messages with ${targetAgentId}:`, error);
      set({
        messagesError: `Failed to load direct messages with ${targetAgentId}`,
        messagesLoading: false,
      });
    }
  },

  sendChannelMessage: async (channel: string, content: string, replyToId?: string) => {
    const { connection } = get();
    if (!connection || !content.trim()) return false;

    console.log(`ChatStore: Sending message to #${channel}: "${content}"`);

    try {
      const response = await connection.sendEvent({
        event_name: replyToId ? EventNames.THREAD_REPLY_SENT : EventNames.THREAD_CHANNEL_MESSAGE_POST,
        source_id: connection.getAgentId(),
        destination_id: `channel:${channel}`,
        payload: {
          channel: channel,
          content: { text: content.trim() },
          message_type: replyToId ? "reply_message" : "channel_message",
          ...(replyToId && { reply_to_id: replyToId }),
        },
      });

      if (response.success) {
        console.log(`ChatStore: Message sent successfully to #${channel}`);
        return true;
      } else {
        console.error(`ChatStore: Failed to send message to #${channel}:`, response.message);
        set({ messagesError: response.message || "Failed to send message" });
        return false;
      }
    } catch (error) {
      console.error(`ChatStore: Failed to send message to #${channel}:`, error);
      set({ messagesError: "Failed to send message" });
      return false;
    }
  },

  sendDirectMessage: async (targetAgentId: string, content: string) => {
    const { connection } = get();
    if (!connection || !content.trim()) return false;

    console.log(`ChatStore: Sending direct message to ${targetAgentId}: "${content}"`);

    try {
      const response = await connection.sendEvent({
        event_name: EventNames.THREAD_DIRECT_MESSAGE_SEND,
        source_id: connection.getAgentId(),
        destination_id: `agent:${targetAgentId}`,
        payload: {
          target_agent_id: targetAgentId,
          content: { text: content.trim() },
          message_type: "direct_message",
        },
      });

      if (response.success) {
        console.log(`ChatStore: Direct message sent successfully to ${targetAgentId}`);
        return true;
      } else {
        console.error(`ChatStore: Failed to send direct message to ${targetAgentId}:`, response.message);
        set({ messagesError: response.message || "Failed to send direct message" });
        return false;
      }
    } catch (error) {
      console.error(`ChatStore: Failed to send direct message to ${targetAgentId}:`, error);
      set({ messagesError: "Failed to send direct message" });
      return false;
    }
  },

  clearMessagesError: () => {
    set({ messagesError: null });
  },

  // Agents management
  loadAgents: async () => {
    const { connection } = get();
    if (!connection) {
      console.warn("ChatStore: No connection available for loadAgents");
      set({ agentsError: "No connection available" });
      return;
    }

    console.log("ChatStore: Loading connected agents...");
    set({ agentsLoading: true, agentsError: null });

    try {
      // 使用 eventConnector 的 getConnectedAgents 方法
      const agents = await connection.getConnectedAgents();

      console.log("ChatStore: Loaded agents:", agents.length);
      set({
        agents: agents,
        agentsLoading: false,
      });
    } catch (error) {
      console.error("ChatStore: Failed to load agents:", error);
      set({
        agentsError: "Failed to load connected agents",
        agentsLoading: false,
      });
    }
  },

  clearAgentsError: () => {
    set({ agentsError: null });
  },

  // Reactions management
  addReaction: async (messageId: string, reactionType: string, channel?: string) => {
    const { connection } = get();
    if (!connection) return false;

    console.log(`ChatStore: Adding reaction ${reactionType} to message ${messageId}`);

    try {
      const response = await connection.sendEvent({
        event_name: EventNames.THREAD_REACTION_ADD,
        source_id: connection.getAgentId(),
        destination_id: channel ? `channel:${channel}` : undefined,
        payload: {
          target_message_id: messageId,
          reaction_type: reactionType,
          action: "add",
        },
      });

      if (response.success) {
        console.log(`ChatStore: Reaction ${reactionType} added successfully to message ${messageId}`);
        return true;
      } else {
        console.error(`ChatStore: Failed to add reaction ${reactionType} to message ${messageId}:`, response.message);
        return false;
      }
    } catch (error) {
      console.error(`ChatStore: Failed to add reaction ${reactionType} to message ${messageId}:`, error);
      return false;
    }
  },

  removeReaction: async (messageId: string, reactionType: string, channel?: string) => {
    const { connection } = get();
    if (!connection) return false;

    console.log(`ChatStore: Removing reaction ${reactionType} from message ${messageId}`);

    try {
      const response = await connection.sendEvent({
        event_name: EventNames.THREAD_REACTION_REMOVE,
        source_id: connection.getAgentId(),
        destination_id: channel ? `channel:${channel}` : undefined,
        payload: {
          target_message_id: messageId,
          reaction_type: reactionType,
          action: "remove",
        },
      });

      if (response.success) {
        console.log(`ChatStore: Reaction ${reactionType} removed successfully from message ${messageId}`);
        return true;
      } else {
        console.error(`ChatStore: Failed to remove reaction ${reactionType} from message ${messageId}:`, response.message);
        return false;
      }
    } catch (error) {
      console.error(`ChatStore: Failed to remove reaction ${reactionType} from message ${messageId}:`, error);
      return false;
    }
  },

  // Real-time updates
  addMessageToChannel: (channel: string, message: UnifiedMessage) => {
    set((state) => {
      const newChannelMessages = new Map(state.channelMessages);
      const currentMessages = newChannelMessages.get(channel) || [];

      // 检查消息是否已存在，避免重复添加
      const exists = currentMessages.some(msg => msg.id === message.id);
      if (exists) {
        console.log(`ChatStore: Message ${message.id} already exists in channel #${channel}, skipping`);
        return state;
      }

      // 添加新消息到末尾
      const updatedMessages = [...currentMessages, message];
      newChannelMessages.set(channel, updatedMessages);

      console.log(`ChatStore: Added message to channel #${channel}:`, message.content);
      return {
        ...state,
        channelMessages: newChannelMessages,
      };
    });
  },

  addMessageToDirect: (targetAgentId: string, message: UnifiedMessage) => {
    set((state) => {
      const newDirectMessages = new Map(state.directMessages);
      const currentMessages = newDirectMessages.get(targetAgentId) || [];

      // 检查消息是否已存在，避免重复添加
      const exists = currentMessages.some(msg => msg.id === message.id);
      if (exists) {
        console.log(`ChatStore: Message ${message.id} already exists in direct messages with ${targetAgentId}, skipping`);
        return state;
      }

      // 添加新消息到末尾
      const updatedMessages = [...currentMessages, message];
      newDirectMessages.set(targetAgentId, updatedMessages);

      console.log(`ChatStore: Added direct message with ${targetAgentId}:`, message.content);
      return {
        ...state,
        directMessages: newDirectMessages,
      };
    });
  },

  updateMessage: (messageId: string, updates: Partial<UnifiedMessage>) => {
    set((state) => {
      let messageUpdated = false;

      // 更新 channel messages
      const newChannelMessages = new Map(state.channelMessages);
      for (const [channel, messages] of newChannelMessages.entries()) {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex >= 0) {
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], ...updates };
          newChannelMessages.set(channel, updatedMessages);
          messageUpdated = true;
          console.log(`ChatStore: Updated message ${messageId} in channel #${channel}`);
          break;
        }
      }

      // 更新 direct messages
      const newDirectMessages = new Map(state.directMessages);
      if (!messageUpdated) {
        for (const [targetAgentId, messages] of newDirectMessages.entries()) {
          const messageIndex = messages.findIndex(msg => msg.id === messageId);
          if (messageIndex >= 0) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], ...updates };
            newDirectMessages.set(targetAgentId, updatedMessages);
            messageUpdated = true;
            console.log(`ChatStore: Updated message ${messageId} in direct messages with ${targetAgentId}`);
            break;
          }
        }
      }

      if (!messageUpdated) {
        console.warn(`ChatStore: Message ${messageId} not found for update`);
      }

      return {
        ...state,
        channelMessages: newChannelMessages,
        directMessages: newDirectMessages,
      };
    });
  },

  // Helper functions
  getChannelMessages: (channel: string) => {
    const { channelMessages } = get();
    return channelMessages.get(channel) || [];
  },

  getDirectMessagesForAgent: (targetAgentId: string, currentAgentId: string) => {
    const { directMessages } = get();
    const messages = directMessages.get(targetAgentId) || [];

    // 过滤属于当前会话的消息
    return messages.filter(message =>
      (message.type === 'direct_message') &&
      (message.senderId === currentAgentId && message.targetUserId === targetAgentId) ||
      (message.senderId === targetAgentId && message.targetUserId === currentAgentId) ||
      (message.senderId === targetAgentId)  // 兼容旧格式
    );
  },

  // Event handling
  setupEventListeners: () => {
    const { connection } = get();
    if (!connection) return;

    console.log("ChatStore: Setting up chat event listeners");

    // 监听 chat 相关事件
    connection.on("rawEvent", (event: any) => {
      console.log("ChatStore: Received raw event:", event.event_name, event);

      // 处理频道消息通知
      if (event.event_name === "thread.channel_message.notification" && event.payload) {
        console.log("ChatStore: Received channel message notification:", event);

        const messageData = event.payload;
        if (messageData.channel && messageData.content) {
          // 构造统一消息格式
          const unifiedMessage: UnifiedMessage = {
            id: messageData.message_id || `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            senderId: messageData.sender_id || event.source_id || "unknown",
            timestamp: messageData.timestamp || new Date().toISOString(),
            content: typeof messageData.content === 'string' ? messageData.content : messageData.content.text || "",
            type: 'channel_message',
            channel: messageData.channel,
            replyToId: messageData.reply_to_id,
            threadLevel: messageData.thread_level,
            reactions: messageData.reactions,
          };

          get().addMessageToChannel(messageData.channel, unifiedMessage);
        }
      }

      // 处理回复消息通知
      else if (event.event_name === "thread.reply.notification" && event.payload) {
        console.log("ChatStore: Received reply notification:", event);

        const messageData = event.payload;
        if (messageData.channel && messageData.content) {
          // 构造统一消息格式
          const unifiedMessage: UnifiedMessage = {
            id: messageData.message_id || `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            senderId: messageData.sender_id || event.source_id || "unknown",
            timestamp: messageData.timestamp || new Date().toISOString(),
            content: typeof messageData.content === 'string' ? messageData.content : messageData.content.text || "",
            type: 'reply_message',
            channel: messageData.channel,
            replyToId: messageData.reply_to_id,
            threadLevel: messageData.thread_level || 1,
            reactions: messageData.reactions,
          };

          get().addMessageToChannel(messageData.channel, unifiedMessage);
        }
      }

      // 处理私信消息通知
      else if (event.event_name === "thread.direct_message.notification" && event.payload) {
        console.log("ChatStore: Received direct message notification:", event);

        const messageData = event.payload;
        if (messageData.content) {
          // 构造统一消息格式
          const unifiedMessage: UnifiedMessage = {
            id: messageData.message_id || `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            senderId: messageData.sender_id || event.source_id || "unknown",
            timestamp: messageData.timestamp || new Date().toISOString(),
            content: typeof messageData.content === 'string' ? messageData.content : messageData.content.text || "",
            type: 'direct_message',
            targetUserId: messageData.target_agent_id,
            reactions: messageData.reactions,
          };

          // 确定对话的目标 agent
          const currentAgentId = connection.getAgentId();
          const targetAgentId = messageData.sender_id === currentAgentId
            ? messageData.target_agent_id
            : messageData.sender_id;

          if (targetAgentId) {
            get().addMessageToDirect(targetAgentId, unifiedMessage);
          }
        }
      }

      // 处理反应通知
      else if (event.event_name === "thread.reaction.notification" && event.payload) {
        console.log("ChatStore: Received reaction notification:", event);

        const reactionData = event.payload;
        if (reactionData.target_message_id && reactionData.reactions) {
          // 更新消息的反应
          get().updateMessage(reactionData.target_message_id, {
            reactions: reactionData.reactions,
          });
        }
      }

      // 处理频道列表响应
      else if (event.event_name === "thread.channels.list_response" && event.payload) {
        console.log("ChatStore: Received channels list response:", event);

        if (event.payload.channels) {
          set({
            channels: event.payload.channels,
            channelsLoading: false,
            channelsError: null,
          });
        }
      }

      // 处理频道消息检索响应
      else if (event.event_name === "thread.channel_messages.retrieve_response" && event.payload) {
        console.log("ChatStore: Received channel messages retrieve response:", event);

        const { channel, messages } = event.payload;
        if (channel && messages) {
          // 转换原始消息为统一格式
          const rawMessages: RawThreadMessage[] = messages;
          const unifiedMessages = MessageAdapter.fromRawThreadMessages(rawMessages);

          // 存储到 channelMessages Map 中
          set((state) => {
            const newChannelMessages = new Map(state.channelMessages);
            newChannelMessages.set(channel, unifiedMessages);
            return {
              channelMessages: newChannelMessages,
              messagesLoading: false,
              messagesError: null,
            };
          });
        }
      }

      // 处理私信检索响应
      else if (event.event_name === "thread.direct_messages.retrieve_response" && event.payload) {
        console.log("ChatStore: Received direct messages retrieve response:", event);

        const { target_agent_id, messages } = event.payload;
        if (target_agent_id && messages) {
          // 转换原始消息为统一格式
          const rawMessages: RawThreadMessage[] = messages;
          const unifiedMessages = MessageAdapter.fromRawThreadMessages(rawMessages);

          // 存储到 directMessages Map 中
          set((state) => {
            const newDirectMessages = new Map(state.directMessages);
            newDirectMessages.set(target_agent_id, unifiedMessages);
            return {
              directMessages: newDirectMessages,
              messagesLoading: false,
              messagesError: null,
            };
          });
        }
      }

      // 处理文件上传响应
      else if (event.event_name === "thread.file.upload_response" && event.payload) {
        console.log("ChatStore: Received file upload response:", event);
        // 可以在这里处理文件上传成功的逻辑
      }
    });
  },

  cleanupEventListeners: () => {
    const { connection } = get();
    if (!connection) return;

    console.log("ChatStore: Cleaning up chat event listeners");
    // 由于使用 rawEvent，事件清理在组件层面管理
    // 这里可以添加特定的清理逻辑，如果需要的话
  },
}));