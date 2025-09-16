/**
 * React Hook for OpenAgents Service
 * 
 * This hook provides a clean React interface to the new event-driven OpenAgents service.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { OpenAgentsService, ConnectionStatus, MessageSendResult, ThreadMessage, ThreadChannel, AgentInfo } from '../services/openAgentsService';

export interface UseOpenAgentsOptions {
  agentId: string;
  host?: string;
  port?: number;
  autoConnect?: boolean;
}

export interface UseOpenAgentsReturn {
  // Connection
  service: OpenAgentsService | null;
  connectionStatus: ConnectionStatus;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  
  // Messaging with immediate feedback
  sendChannelMessage: (channel: string, content: string, replyToId?: string) => Promise<MessageSendResult>;
  sendDirectMessage: (targetAgentId: string, content: string) => Promise<MessageSendResult>;
  addReaction: (messageId: string, reactionType: string, channel?: string) => Promise<MessageSendResult>;
  removeReaction: (messageId: string, reactionType: string, channel?: string) => Promise<MessageSendResult>;
  
  // Data loading with immediate results
  loadChannels: () => Promise<ThreadChannel[]>;
  loadChannelMessages: (channel: string, limit?: number, offset?: number) => Promise<ThreadMessage[]>;
  loadDirectMessages: (targetAgentId: string, limit?: number, offset?: number) => Promise<ThreadMessage[]>;
  loadConnectedAgents: () => Promise<AgentInfo[]>;
  
  // Real-time data
  channels: ThreadChannel[];
  messages: ThreadMessage[];
  setMessages: (messages: ThreadMessage[]) => void;
  
  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Error handling
  lastError: string | null;
  clearError: () => void;
}

export const useOpenAgents = (options: UseOpenAgentsOptions): UseOpenAgentsReturn => {
  const [service, setService] = useState<OpenAgentsService | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'disconnected' });
  const [channels, setChannels] = useState<ThreadChannel[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Use ref to avoid recreating service on every render
  const serviceRef = useRef<OpenAgentsService | null>(null);

  // Initialize service
  useEffect(() => {
    // Clean up any existing service first
    if (serviceRef.current) {
      console.log('🔧 Cleaning up existing service for agent:', serviceRef.current.getAgentId?.() || 'unknown');
      serviceRef.current.disconnect().catch(console.warn);
      serviceRef.current = null;
      setService(null);
    }

    if (options.agentId && options.host && options.port) {
      console.log('🔧 Initializing OpenAgents service...', { 
        agentId: options.agentId, 
        host: options.host, 
        port: options.port,
        autoConnect: options.autoConnect 
      });
      
      const newService = new OpenAgentsService({
        agentId: options.agentId,
        host: options.host,
        port: options.port
      });

      // Setup event handlers
      newService.on('connectionStatusChanged', (status: ConnectionStatus) => {
        setConnectionStatus(status);
      });

      newService.on('connectionError', (data: any) => {
        setLastError(data.error || 'Connection error');
      });

      newService.on('newChannelMessage', (message: ThreadMessage) => {
        setMessages(prev => {
          // Check if message already exists (to avoid duplicates)
          const exists = prev.some(existingMsg => existingMsg.message_id === message.message_id);
          if (exists) {
            console.log('📨 Duplicate channel message ignored:', message.message_id);
            return prev;
          }
          return [...prev, message];
        });
      });

      newService.on('newDirectMessage', (message: ThreadMessage) => {
        setMessages(prev => {
          // Check if message already exists (to avoid duplicates)
          const exists = prev.some(existingMsg => existingMsg.message_id === message.message_id);
          if (exists) {
            console.log('📨 Duplicate direct message ignored:', message.message_id);
            return prev;
          }
          return [...prev, message];
        });
      });

      newService.on('newReaction', (reaction: any) => {
        // Update reaction count in existing messages
        setMessages(prev => prev.map(msg => {
          if (msg.message_id === reaction.message_id) {
            const reactions = { ...msg.reactions } || {};
            if (reaction.action === 'add') {
              reactions[reaction.reaction_type] = (reactions[reaction.reaction_type] || 0) + 1;
            } else if (reaction.action === 'remove') {
              reactions[reaction.reaction_type] = Math.max(0, (reactions[reaction.reaction_type] || 1) - 1);
            }
            return { ...msg, reactions };
          }
          return msg;
        }));
      });

      serviceRef.current = newService;
      setService(newService);

      // Auto-connect if requested
      if (options.autoConnect) {
        newService.connect().catch(error => {
          setLastError(`Auto-connect failed: ${error.message}`);
        });
      }
    }

    // Only disconnect on unmount, not on re-renders
    return () => {
      // Do nothing here - let the component cleanup handle disconnection
    };
  }, [options.agentId, options.host, options.port, options.autoConnect]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        console.log('🔌 Cleaning up OpenAgents service on unmount');
        serviceRef.current.disconnect().catch(error => {
          console.warn('Error during service cleanup:', error);
        });
        serviceRef.current = null;
      }
    };
  }, []);

  // Connection methods
  const connect = useCallback(async (): Promise<boolean> => {
    if (!service) return false;
    
    setLastError(null);
    setLoading(true);
    
    try {
      const success = await service.connect();
      if (!success) {
        setLastError('Failed to connect to OpenAgents network');
      }
      return success;
    } catch (error: any) {
      setLastError(error.message || 'Connection error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [service]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!service) return;
    
    try {
      await service.disconnect();
    } catch (error: any) {
      console.error('Disconnect error:', error);
    }
  }, [service]);

  // Messaging methods with immediate feedback
  const sendChannelMessage = useCallback(async (channel: string, content: string, replyToId?: string): Promise<MessageSendResult> => {
    if (!service) {
      return { success: false, message: 'Not connected to service' };
    }

    setLastError(null);
    
    try {
      const result = await service.sendChannelMessage(channel, content, replyToId);
      if (!result.success && result.message) {
        setLastError(result.message);
      }
      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to send message';
      setLastError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [service]);

  const sendDirectMessage = useCallback(async (targetAgentId: string, content: string): Promise<MessageSendResult> => {
    if (!service) {
      return { success: false, message: 'Not connected to service' };
    }

    setLastError(null);
    
    try {
      const result = await service.sendDirectMessage(targetAgentId, content);
      if (!result.success && result.message) {
        setLastError(result.message);
      }
      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to send direct message';
      setLastError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [service]);

  const addReaction = useCallback(async (messageId: string, reactionType: string, channel?: string): Promise<MessageSendResult> => {
    if (!service) {
      return { success: false, message: 'Not connected to service' };
    }

    try {
      const result = await service.addReaction(messageId, reactionType, channel);
      if (!result.success && result.message) {
        setLastError(result.message);
      }
      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to add reaction';
      setLastError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [service]);

  const removeReaction = useCallback(async (messageId: string, reactionType: string, channel?: string): Promise<MessageSendResult> => {
    if (!service) {
      return { success: false, message: 'Not connected to service' };
    }

    try {
      const result = await service.removeReaction(messageId, reactionType, channel);
      if (!result.success && result.message) {
        setLastError(result.message);
      }
      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to remove reaction';
      setLastError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [service]);

  // Data loading methods with immediate results
  const loadChannels = useCallback(async (): Promise<ThreadChannel[]> => {
    if (!service) return [];

    setLastError(null);
    setLoading(true);
    
    try {
      const channelList = await service.getChannels();
      setChannels(channelList);
      return channelList;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to load channels';
      setLastError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [service]);

  const loadChannelMessages = useCallback(async (channel: string, limit?: number, offset?: number): Promise<ThreadMessage[]> => {
    if (!service) return [];

    setLastError(null);
    setLoading(true);
    
    try {
      const messageList = await service.getChannelMessages(channel, limit, offset);
      
      // Replace messages if offset is 0 (initial load), otherwise append (pagination)
      if (!offset || offset === 0) {
        setMessages(messageList);
      } else {
        // Prepend older messages, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.message_id));
          const newMessages = messageList.filter(msg => !existingIds.has(msg.message_id));
          return [...newMessages, ...prev];
        });
      }
      
      return messageList;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to load messages';
      setLastError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [service]);

  const loadDirectMessages = useCallback(async (targetAgentId: string, limit?: number, offset?: number): Promise<ThreadMessage[]> => {
    if (!service) return [];

    setLastError(null);
    setLoading(true);
    
    try {
      const messageList = await service.getDirectMessages(targetAgentId, limit, offset);
      
      // Replace messages if offset is 0 (initial load), otherwise append (pagination)
      if (!offset || offset === 0) {
        setMessages(messageList);
      } else {
        // Prepend older messages, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.message_id));
          const newMessages = messageList.filter(msg => !existingIds.has(msg.message_id));
          return [...newMessages, ...prev];
        });
      }
      
      return messageList;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to load direct messages';
      setLastError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [service]);

  const loadConnectedAgents = useCallback(async (): Promise<AgentInfo[]> => {
    if (!service) return [];

    setLastError(null);
    
    try {
      const agentList = await service.getConnectedAgents();
      return agentList;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to load connected agents';
      setLastError(errorMsg);
      return [];
    }
  }, [service]);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    // Connection
    service,
    connectionStatus,
    connect,
    disconnect,
    
    // Messaging
    sendChannelMessage,
    sendDirectMessage,
    addReaction,
    removeReaction,
    
    // Data loading
    loadChannels,
    loadChannelMessages,
    loadDirectMessages,
    loadConnectedAgents,
    
    // State
    channels,
    messages,
    setMessages,
    isLoading,
    setLoading,
    
    // Error handling
    lastError,
    clearError
  };
};