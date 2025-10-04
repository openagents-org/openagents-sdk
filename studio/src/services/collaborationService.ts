import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as awarenessProtocol from 'y-protocols/awareness';

// 用户信息接口
export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
}

// 连接状态枚举
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
}

// 协作服务类
export class CollaborationService {
  private ydoc: Y.Doc;
  private provider: WebsocketProvider;
  private ytext: Y.Text;
  private awareness: awarenessProtocol.Awareness;
  private userId: string;
  private roomName: string;
  private websocketUrl: string;
  private userName?: string;

  // 事件回调
  private onStatusChange?: (status: ConnectionStatus) => void;
  private onUsersChange?: (users: CollaborationUser[]) => void;
  private onCursorChange?: (userId: string, user: CollaborationUser) => void;
  private onContentChange?: (content: string) => void;
  private onError?: (error: Error) => void;

  // 状态
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private users: Map<string, CollaborationUser> = new Map();
  private retryCount = 0;
  private maxRetries = 5;
  private retryDelay = 1000;

  // 用户颜色池
  private static COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
    '#10AC84', '#EE5A24', '#0652DD', '#9C88FF', '#FFC312'
  ];
  private static colorIndex = 0;

  constructor(
    roomName: string,
    userId?: string,
    websocketUrl: string = 'ws://localhost:1234',
    userName?: string
  ) {
    this.roomName = roomName;
    this.userId = userId || this.generateUserId();
    this.websocketUrl = websocketUrl;
    this.userName = userName;

    console.log('🔧 [CollaborationService] Initializing service...');
    console.log('   🏠 Room:', roomName);
    console.log('   👤 User ID:', this.userId);
    console.log('   🌐 WebSocket:', websocketUrl);

    // 创建 Yjs 文档
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('monaco');

    // 初始化 WebSocket 提供者
    this.provider = new WebsocketProvider(
      this.websocketUrl,
      this.roomName,
      this.ydoc
    );

    console.log('🔌 [CollaborationService] WebSocket provider created');

    // 获取 awareness 实例
    this.awareness = this.provider.awareness;

    this.setupEventListeners();
  }

  // 生成用户ID
  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // 获取用户颜色
  private getUserColor(): string {
    const color = CollaborationService.COLORS[CollaborationService.colorIndex % CollaborationService.COLORS.length];
    CollaborationService.colorIndex++;
    return color;
  }

  // 生成用户名
  private generateUserName(): string {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const adjectives = ['Creative', 'Smart', 'Friendly', 'Bold', 'Clever', 'Bright', 'Quick', 'Wise'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
  }

  // 设置事件监听器
  private setupEventListeners() {
    console.log('👂 [CollaborationService] Setting up event listeners...');

    // 连接状态监听
    this.provider.on('status', (event: { status: string }) => {
      const prevStatus = this.connectionStatus;
      console.log(`📡 [CollaborationService] Provider status event:`, event.status);

      switch (event.status) {
        case 'connecting':
          this.connectionStatus = ConnectionStatus.CONNECTING;
          console.log('🔄 [CollaborationService] Connecting to server...');
          break;
        case 'connected':
          this.connectionStatus = ConnectionStatus.CONNECTED;
          this.retryCount = 0;
          console.log('✅ [CollaborationService] Connected to server!');

          // 设置本地用户信息
          const userName = this.userName || this.generateUserName();
          const userColor = this.getUserColor();
          this.awareness.setLocalStateField('user', {
            id: this.userId,
            name: userName,
            color: userColor
          });
          console.log(`👤 [CollaborationService] User registered: ${userName} (${userColor})`);
          break;
        case 'disconnected':
          this.connectionStatus = ConnectionStatus.DISCONNECTED;
          console.log('❌ [CollaborationService] Disconnected from server');
          this.handleDisconnection();
          break;
      }

      if (prevStatus !== this.connectionStatus) {
        console.log(`🔗 [CollaborationService] Connection status changed: ${prevStatus} → ${this.connectionStatus}`);
        this.onStatusChange?.(this.connectionStatus);
      }
    });

    // Awareness 变化监听
    this.awareness.on('change', () => {
      console.log('👥 [CollaborationService] Awareness changed, updating users...');
      this.updateUsersFromAwareness();
    });

    // 文档变更监听
    this.ytext.observe((event) => {
      const content = this.ytext.toString();
      console.log('📝 [CollaborationService] Document content changed, length:', content.length);
      this.onContentChange?.(content);
    });

    // WebSocket 错误处理
    this.provider.ws?.addEventListener('error', (error) => {
      console.error('🔴 WebSocket error:', error);
      this.onError?.(new Error('WebSocket connection error'));
    });

    // WebSocket 关闭处理
    this.provider.ws?.addEventListener('close', (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      if (!event.wasClean) {
        this.handleDisconnection();
      }
    });
  }

  // 从 awareness 更新用户列表
  private updateUsersFromAwareness() {
    const users: CollaborationUser[] = [];

    this.awareness.getStates().forEach((state, clientId) => {
      if (state.user) {
        const user: CollaborationUser = {
          id: state.user.id || `client-${clientId}`,
          name: state.user.name || `User ${clientId}`,
          color: state.user.color || '#666666',
          cursor: state.cursor
        };
        users.push(user);
        this.users.set(user.id, user);

        // 触发光标更新回调
        if (state.cursor && clientId !== this.awareness.clientID) {
          this.onCursorChange?.(user.id, user);
        }
      }
    });

    this.onUsersChange?.(users);
  }


  // 处理断开连接
  private handleDisconnection() {
    if (this.retryCount < this.maxRetries) {
      this.connectionStatus = ConnectionStatus.RECONNECTING;
      this.onStatusChange?.(this.connectionStatus);

      this.retryCount++;
      const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // 指数退避

      console.log(`🔄 Attempting to reconnect (${this.retryCount}/${this.maxRetries}) in ${delay}ms`);

      setTimeout(() => {
        this.reconnect();
      }, delay);
    } else {
      console.error('🔴 Max reconnection attempts reached');
      this.onError?.(new Error('Failed to reconnect after multiple attempts'));
    }
  }

  // 重新连接
  private reconnect() {
    try {
      this.provider.disconnect();
      this.provider = new WebsocketProvider(
        this.websocketUrl,
        this.roomName,
        this.ydoc,
        {
          params: {
            userId: this.userId
          }
        }
      );
      this.setupEventListeners();
    } catch (error) {
      console.error('🔴 Reconnection failed:', error);
      this.handleDisconnection();
    }
  }

  // 发送光标位置
  public updateCursor(line: number, column: number) {
    try {
      this.awareness.setLocalStateField('cursor', { line, column });
    } catch (error) {
      console.error('🔴 Failed to update cursor:', error);
    }
  }

  // 发送心跳（不再需要，awareness 自动处理）
  public sendHeartbeat() {
    // No-op - awareness handles heartbeat automatically
  }

  // 获取文档内容
  public getContent(): string {
    return this.ytext.toString();
  }

  // 设置文档内容（初始化时使用）
  public setInitialContent(content: string) {
    if (this.ytext.length === 0 && content) {
      this.ytext.insert(0, content);
    }
  }

  // 获取当前用户信息
  public getCurrentUser(): CollaborationUser | null {
    return this.users.get(this.userId) || null;
  }

  // 获取所有用户
  public getUsers(): CollaborationUser[] {
    return Array.from(this.users.values());
  }

  // 获取连接状态
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  // 获取 Yjs 文档和文本对象
  public getYDoc(): Y.Doc {
    return this.ydoc;
  }

  public getYText(): Y.Text {
    return this.ytext;
  }

  // 事件回调设置
  public onConnectionStatusChange(callback: (status: ConnectionStatus) => void) {
    this.onStatusChange = callback;
  }

  public onUsersUpdate(callback: (users: CollaborationUser[]) => void) {
    this.onUsersChange = callback;
  }

  public onCursorUpdate(callback: (userId: string, user: CollaborationUser) => void) {
    this.onCursorChange = callback;
  }

  public onContentUpdate(callback: (content: string) => void) {
    this.onContentChange = callback;
  }

  public onErrorOccurred(callback: (error: Error) => void) {
    this.onError = callback;
  }

  // 清理资源
  public destroy() {
    try {
      // 清理事件监听器
      this.onStatusChange = undefined;
      this.onUsersChange = undefined;
      this.onCursorChange = undefined;
      this.onContentChange = undefined;
      this.onError = undefined;

      // 清理 awareness 本地状态
      this.awareness.setLocalState(null);

      // 断开连接
      this.provider.disconnect();

      // 销毁文档
      this.ydoc.destroy();

      console.log('🧹 Collaboration service destroyed');
    } catch (error) {
      console.error('🔴 Error destroying collaboration service:', error);
    }
  }
}

// 服务工厂函数
export function createCollaborationService(
  documentId: string,
  userId?: string,
  serverUrl?: string
): CollaborationService {
  return new CollaborationService(
    `document-${documentId}`,
    userId,
    serverUrl
  );
}

// 导出常量
export const DEFAULT_WEBSOCKET_URL = 'ws://localhost:1234';
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds