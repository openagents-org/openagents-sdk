import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DocumentInfo } from "@/types";
import { ThreadState } from "@/types/thread";
import { CollaborationService, CollaborationUser, ConnectionStatus } from "@/services/collaborationService";

// 数据版本号 - 用于控制 localStorage 数据兼容性
const STORAGE_VERSION = 2; // 增加版本号以清理旧数据

interface DocumentStoreState {
  // 数据版本
  version: number;

  // 简化的线程状态 - 只存储当前选择
  threadState: ThreadState | null;

  // 文档相关状态
  documents: DocumentInfo[];
  selectedDocumentId: string | null;

  // 协作功能状态
  collaborationServices: Map<string, CollaborationService>;
  connectionStatuses: Map<string, ConnectionStatus>;
  onlineUsers: Map<string, CollaborationUser[]>;
  isCollaborationEnabled: boolean;

  // 线程操作
  setThreadState: (state: ThreadState | null) => void;
  updateThreadState: (updates: Partial<ThreadState>) => void;

  // 文档操作
  setDocuments: (documents: DocumentInfo[]) => void;
  addDocument: (document: DocumentInfo) => void;
  updateDocument: (documentId: string, updates: Partial<DocumentInfo>) => void;
  removeDocument: (documentId: string) => void;
  setSelectedDocument: (documentId: string | null) => void;

  // 协作功能操作
  initializeCollaboration: (documentId: string, userId?: string) => Promise<CollaborationService>;
  destroyCollaboration: (documentId: string) => void;
  getCollaborationService: (documentId: string) => CollaborationService | null;
  updateConnectionStatus: (documentId: string, status: ConnectionStatus) => void;
  updateOnlineUsers: (documentId: string, users: CollaborationUser[]) => void;
  setCollaborationEnabled: (enabled: boolean) => void;

  // 文档内容操作
  getDocumentContent: (documentId: string) => string | null;
  saveDocumentContent: (documentId: string, content: string) => Promise<boolean>;
  createDocument: (name: string, content?: string) => Promise<string | null>;
}

// 清理旧版本的 localStorage 数据
const cleanupOldStorage = () => {
  try {
    const stored = localStorage.getItem('openagents_documents');
    if (stored) {
      const parsed = JSON.parse(stored);
      // 检查版本号，如果版本不匹配或没有版本号，清理数据
      if (!parsed.state?.version || parsed.state.version < STORAGE_VERSION) {
        console.log('🧹 Cleaning up old localStorage data...');
        localStorage.removeItem('openagents_documents');
      }
    }
  } catch (error) {
    console.error('Error cleaning up storage:', error);
    // 如果解析失败，直接清理
    localStorage.removeItem('openagents_documents');
  }
};

// 在创建 store 之前清理旧数据
cleanupOldStorage();

export const useDocumentStore = create<DocumentStoreState>()(
  persist(
    (set, get) => ({
      // 初始状态
      version: STORAGE_VERSION,
      threadState: null,
      documents: [],
      selectedDocumentId: null,
      collaborationServices: new Map(),
      connectionStatuses: new Map(),
      onlineUsers: new Map(),
      isCollaborationEnabled: true,

      // 设置完整的线程状态
      setThreadState: (state: ThreadState | null) => {
        set({ threadState: state });
      },

      // 更新部分线程状态
      updateThreadState: (updates: Partial<ThreadState>) => {
        set((state) => ({
          threadState: state.threadState
            ? { ...state.threadState, ...updates }
            : {
                currentChannel: null,
                currentDirectMessage: null,
                ...updates,
              },
        }));
      },

      // 设置文档列表
      setDocuments: (documents: DocumentInfo[]) => {
        set({ documents });
      },

      // 添加文档
      addDocument: (document: DocumentInfo) => {
        set((state) => ({
          documents: [...state.documents, document],
        }));
      },

      // 更新文档
      updateDocument: (documentId: string, updates: Partial<DocumentInfo>) => {
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.document_id === documentId ? { ...doc, ...updates } : doc
          ),
        }));
      },

      // 移除文档
      removeDocument: (documentId: string) => {
        const state = get();

        // 清理协作服务
        const collaborationService = state.collaborationServices.get(documentId);
        if (collaborationService) {
          collaborationService.destroy();
          state.collaborationServices.delete(documentId);
          state.connectionStatuses.delete(documentId);
          state.onlineUsers.delete(documentId);
        }

        set((state) => ({
          documents: state.documents.filter(
            (doc) => doc.document_id !== documentId
          ),
          // 如果移除的是当前选中的文档，清除选择
          selectedDocumentId:
            state.selectedDocumentId === documentId
              ? null
              : state.selectedDocumentId,
        }));
      },

      // 设置选中的文档
      setSelectedDocument: (documentId: string | null) => {
        set({ selectedDocumentId: documentId });
      },

      // 初始化协作服务
      initializeCollaboration: async (documentId: string, userId?: string) => {
        const state = get();

        // 检查是否已经存在服务
        if (state.collaborationServices.has(documentId)) {
          return state.collaborationServices.get(documentId)!;
        }

        try {
          const collaborationService = new CollaborationService(
            `document-${documentId}`,
            userId,
            'ws://localhost:1234'
          );

          // 设置事件监听器
          collaborationService.onConnectionStatusChange((status) => {
            get().updateConnectionStatus(documentId, status);
          });

          collaborationService.onUsersUpdate((users) => {
            get().updateOnlineUsers(documentId, users);
          });

          collaborationService.onContentUpdate((content) => {
            // 可以在这里自动保存内容
            console.log(`📝 Document ${documentId} content updated:`, content.length, 'characters');
          });

          collaborationService.onErrorOccurred((error) => {
            console.error(`🔴 Collaboration error for document ${documentId}:`, error);
          });

          // 存储服务
          state.collaborationServices.set(documentId, collaborationService);

          return collaborationService;
        } catch (error) {
          console.error('Failed to initialize collaboration:', error);
          throw error;
        }
      },

      // 销毁协作服务
      destroyCollaboration: (documentId: string) => {
        const state = get();
        const collaborationService = state.collaborationServices.get(documentId);

        if (collaborationService) {
          collaborationService.destroy();
          state.collaborationServices.delete(documentId);
          state.connectionStatuses.delete(documentId);
          state.onlineUsers.delete(documentId);

          set({
            collaborationServices: new Map(state.collaborationServices),
            connectionStatuses: new Map(state.connectionStatuses),
            onlineUsers: new Map(state.onlineUsers)
          });
        }
      },

      // 获取协作服务
      getCollaborationService: (documentId: string) => {
        const state = get();
        return state.collaborationServices.get(documentId) || null;
      },

      // 更新连接状态
      updateConnectionStatus: (documentId: string, status: ConnectionStatus) => {
        const state = get();
        state.connectionStatuses.set(documentId, status);

        set({
          connectionStatuses: new Map(state.connectionStatuses)
        });
      },

      // 更新在线用户
      updateOnlineUsers: (documentId: string, users: CollaborationUser[]) => {
        const state = get();
        state.onlineUsers.set(documentId, users);

        // 同时更新文档的活跃用户列表
        get().updateDocument(documentId, {
          active_agents: users.map(user => user.name)
        });

        set({
          onlineUsers: new Map(state.onlineUsers)
        });
      },

      // 设置协作功能开关
      setCollaborationEnabled: (enabled: boolean) => {
        set({ isCollaborationEnabled: enabled });
      },

      // 获取文档内容
      getDocumentContent: (documentId: string) => {
        const state = get();
        const collaborationService = state.collaborationServices.get(documentId);

        if (collaborationService) {
          return collaborationService.getContent();
        }

        // 如果没有协作服务，返回空内容或从其他地方获取
        return '';
      },

      // 保存文档内容
      saveDocumentContent: async (documentId: string, content: string) => {
        try {
          // 这里可以实现将内容保存到服务器的逻辑
          console.log(`💾 Saving document ${documentId} with ${content.length} characters`);

          // 模拟保存操作
          await new Promise(resolve => setTimeout(resolve, 500));

          // 更新文档的最后修改时间
          get().updateDocument(documentId, {
            last_modified: new Date().toISOString(),
            version: (get().documents.find(doc => doc.document_id === documentId)?.version || 0) + 1
          });

          return true;
        } catch (error) {
          console.error('Failed to save document:', error);
          return false;
        }
      },

      // 创建新文档
      createDocument: async (name: string, content: string = '') => {
        try {
          const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const now = new Date().toISOString();

          const newDocument: DocumentInfo = {
            document_id: documentId,
            name: name,
            creator: 'current-user', // 这里应该从用户状态获取
            created: now,
            last_modified: now,
            version: 1,
            active_agents: [],
            permission: 'read_write'
          };

          // 添加到文档列表
          get().addDocument(newDocument);

          // 如果有初始内容，设置内容
          if (content && get().isCollaborationEnabled) {
            const collaborationService = await get().initializeCollaboration(documentId);
            collaborationService.setInitialContent(content);
          }

          return documentId;
        } catch (error) {
          console.error('Failed to create document:', error);
          return null;
        }
      },
    }),
    {
      name: "openagents_documents", // localStorage key
      partialize: (state) => ({
        // 持久化版本号和基本状态，不持久化文档列表（确保所有用户看到相同的默认文档）
        version: state.version,
        threadState: state.threadState,
        // documents: state.documents, // 移除文档列表的持久化，让所有用户看到相同的公共文档
        selectedDocumentId: state.selectedDocumentId,
        isCollaborationEnabled: state.isCollaborationEnabled,
      }),
    }
  )
);
