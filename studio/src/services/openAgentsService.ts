/**
 * Pure Event-based OpenAgents Service
 * 
 * This service implements the event-driven architecture using HTTP transport.
 * It provides immediate synchronous responses for all operations.
 */

import { EventNetworkService } from './eventNetworkService';
import { ThreadMessage, ThreadChannel, AgentInfo } from '../types/events';
import { NetworkConnection } from './networkService';

export interface OpenAgentsServiceOptions {
  agentId: string;
  host?: string;
  port?: number;
  timeout?: number;
}

export interface MessageSendResult {
  success: boolean;
  message?: string;
  messageId?: string;
}

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  agentId?: string;
  isUsingModifiedId?: boolean;
  latency?: number;
}

export class OpenAgentsService {
  private eventService: EventNetworkService;
  private connectionStatus: ConnectionStatus = { status: 'disconnected' };
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private agentId: string;

  constructor(options: OpenAgentsServiceOptions) {
    this.agentId = options.agentId;
    
    const connection: NetworkConnection = {
      host: options.host || 'localhost',
      port: options.port || 8571,
      status: 'disconnected'
    };

    this.eventService = new EventNetworkService({
      agentId: this.agentId,
      connection,
      timeout: options.timeout
    });

    this.setupEventHandlers();
  }

  /**
   * Connection Management
   */
  async connect(): Promise<boolean> {
    console.log('🔌 Connecting to OpenAgents network via pure event system...');
    
    this.connectionStatus.status = 'connecting';
    this.emit('connectionStatusChanged', this.connectionStatus);

    const success = await this.eventService.connect();
    
    if (success) {
      this.connectionStatus = {
        status: 'connected',
        agentId: this.eventService.getAgentId(),
        isUsingModifiedId: this.eventService.isUsingModifiedId()
      };
      console.log(`✅ Connected as ${this.connectionStatus.agentId}`);
    } else {
      this.connectionStatus.status = 'error';
    }

    this.emit('connectionStatusChanged', this.connectionStatus);
    return success;
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from OpenAgents network...');
    await this.eventService.disconnect();
    this.connectionStatus.status = 'disconnected';
    this.emit('connectionStatusChanged', this.connectionStatus);
  }

  /**
   * Messaging Operations - All return immediate results
   */
  async sendChannelMessage(channel: string, content: string, replyToId?: string): Promise<MessageSendResult> {
    console.log(`📤 Sending message to #${channel}: "${content}"`);
    
    const response = await this.eventService.sendChannelMessage(channel, content, replyToId);
    
    return {
      success: response.success,
      message: response.message,
      messageId: response.data?.message_id
    };
  }

  async sendDirectMessage(targetAgentId: string, content: string): Promise<MessageSendResult> {
    console.log(`📤 Sending direct message to ${targetAgentId}: "${content}"`);
    
    const response = await this.eventService.sendDirectMessage(targetAgentId, content);
    
    return {
      success: response.success,
      message: response.message,
      messageId: response.data?.message_id
    };
  }

  async addReaction(messageId: string, reactionType: string, channel?: string): Promise<MessageSendResult> {
    console.log(`😀 Adding reaction ${reactionType} to message ${messageId}`);
    
    const response = await this.eventService.addReaction(messageId, reactionType, channel);
    
    return {
      success: response.success,
      message: response.message
    };
  }

  async removeReaction(messageId: string, reactionType: string, channel?: string): Promise<MessageSendResult> {
    console.log(`😀 Removing reaction ${reactionType} from message ${messageId}`);
    
    const response = await this.eventService.removeReaction(messageId, reactionType, channel);
    
    return {
      success: response.success,
      message: response.message
    };
  }

  /**
   * Data Retrieval - All return immediate results
   */
  async getChannels(): Promise<ThreadChannel[]> {
    console.log('📋 Getting channels...');
    return await this.eventService.getChannels();
  }

  async getChannelMessages(channel: string, limit: number = 50, offset: number = 0): Promise<ThreadMessage[]> {
    console.log(`📝 Getting messages for #${channel} (limit: ${limit}, offset: ${offset})`);
    return await this.eventService.getChannelMessages(channel, limit, offset);
  }

  async getDirectMessages(targetAgentId: string, limit: number = 50, offset: number = 0): Promise<ThreadMessage[]> {
    console.log(`📝 Getting direct messages with ${targetAgentId} (limit: ${limit}, offset: ${offset})`);
    return await this.eventService.getDirectMessages(targetAgentId, limit, offset);
  }

  async getConnectedAgents(): Promise<AgentInfo[]> {
    console.log('👥 Getting connected agents...');
    return await this.eventService.getConnectedAgents();
  }

  /**
   * Agent and Network Info
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  getAgentId(): string {
    return this.eventService.getAgentId();
  }

  getOriginalAgentId(): string {
    return this.eventService.getOriginalAgentId();
  }

  isConnected(): boolean {
    return this.eventService.isConnected();
  }

  isUsingModifiedId(): boolean {
    return this.eventService.isUsingModifiedId();
  }

  /**
   * Event Handling for Real-time Updates
   */
  on(eventName: string, handler: Function): void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName)!.add(handler);
  }

  off(eventName: string, handler?: Function): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      if (handler) {
        handlers.delete(handler);
      } else {
        handlers.clear();
      }
    }
  }

  private emit(eventName: string, data: any): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      });
    }
  }

  private setupEventHandlers(): void {
    // Connection events
    this.eventService.on('connected', (data: any) => {
      this.connectionStatus = {
        status: 'connected',
        agentId: data.agentId,
        isUsingModifiedId: this.eventService.isUsingModifiedId()
      };
      this.emit('connected', data);
      this.emit('connectionStatusChanged', this.connectionStatus);
    });

    this.eventService.on('disconnected', (data: any) => {
      this.connectionStatus.status = 'disconnected';
      this.emit('disconnected', data);
      this.emit('connectionStatusChanged', this.connectionStatus);
    });

    this.eventService.on('connectionError', (data: any) => {
      this.connectionStatus.status = 'error';
      this.emit('connectionError', data);
      this.emit('connectionStatusChanged', this.connectionStatus);
    });

    this.eventService.on('reconnecting', (data: any) => {
      this.connectionStatus.status = 'connecting';
      this.emit('reconnecting', data);
      this.emit('connectionStatusChanged', this.connectionStatus);
    });

    this.eventService.on('reconnected', (data: any) => {
      this.connectionStatus.status = 'connected';
      this.emit('reconnected', data);
      this.emit('connectionStatusChanged', this.connectionStatus);
    });

    // Real-time message events
    this.eventService.on('channelMessage', (message: ThreadMessage) => {
      console.log(`📨 New channel message in #${message.channel} from ${message.sender_id}`);
      this.emit('newChannelMessage', message);
      this.emit('newMessage', message); // Generic event
    });

    this.eventService.on('directMessage', (message: ThreadMessage) => {
      console.log(`📨 New direct message from ${message.sender_id}`);
      this.emit('newDirectMessage', message);
      this.emit('newMessage', message); // Generic event
    });

    this.eventService.on('reaction', (reaction: any) => {
      console.log(`😀 New reaction: ${reaction.reaction_type} on message ${reaction.message_id}`);
      this.emit('newReaction', reaction);
    });

    // Debug events
    this.eventService.on('rawEvent', (event: any) => {
      console.log(`📨 Raw event: ${event.event_name}`, event);
      this.emit('rawEvent', event);
    });
  }
}

// Export types for components
export type { ThreadMessage, ThreadChannel, AgentInfo, EventResponse } from '../types/events';