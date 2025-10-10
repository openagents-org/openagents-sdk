import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DocumentInfo } from "@/types";
import { ThreadState } from "@/types/thread";
import {
  CollaborationService,
  CollaborationUser,
  ConnectionStatus,
} from "@/services/collaborationService";

// Data version number - used to control localStorage data compatibility
const STORAGE_VERSION = 2; // Increment version number to clean old data

interface DocumentStoreState {
  // Data version
  version: number;

  // Simplified thread state - only stores current selection
  threadState: ThreadState | null;

  // Document-related state
  documents: DocumentInfo[];
  selectedDocumentId: string | null;

  // Collaboration feature state
  collaborationServices: Map<string, CollaborationService>;
  connectionStatuses: Map<string, ConnectionStatus>;
  onlineUsers: Map<string, CollaborationUser[]>;
  isCollaborationEnabled: boolean;

  // Thread operations
  setThreadState: (state: ThreadState | null) => void;
  updateThreadState: (updates: Partial<ThreadState>) => void;

  // Document operations
  setDocuments: (documents: DocumentInfo[]) => void;
  addDocument: (document: DocumentInfo) => void;
  updateDocument: (documentId: string, updates: Partial<DocumentInfo>) => void;
  removeDocument: (documentId: string) => void;
  setSelectedDocument: (documentId: string | null) => void;

  // Collaboration feature operations
  initializeCollaboration: (
    documentId: string,
    userId?: string
  ) => Promise<CollaborationService>;
  destroyCollaboration: (documentId: string) => void;
  getCollaborationService: (documentId: string) => CollaborationService | null;
  updateConnectionStatus: (
    documentId: string,
    status: ConnectionStatus
  ) => void;
  updateOnlineUsers: (documentId: string, users: CollaborationUser[]) => void;
  setCollaborationEnabled: (enabled: boolean) => void;

  // Document content operations
  getDocumentContent: (documentId: string) => string | null;
  saveDocumentContent: (
    documentId: string,
    content: string
  ) => Promise<boolean>;
  createDocument: (name: string, content?: string) => Promise<string | null>;
}

// Clean up old localStorage data
const cleanupOldStorage = () => {
  try {
    const stored = localStorage.getItem("openagents_documents");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check version number, clear data if version doesn't match or doesn't exist
      if (!parsed.state?.version || parsed.state.version < STORAGE_VERSION) {
        console.log("🧹 Cleaning up old localStorage data...");
        localStorage.removeItem("openagents_documents");
      }
    }
  } catch (error) {
    console.error("Error cleaning up storage:", error);
    // If parsing fails, clean up directly
    localStorage.removeItem("openagents_documents");
  }
};

// Clean up old data before creating store
cleanupOldStorage();

export const useDocumentStore = create<DocumentStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      version: STORAGE_VERSION,
      threadState: null,
      documents: [],
      selectedDocumentId: null,
      collaborationServices: new Map(),
      connectionStatuses: new Map(),
      onlineUsers: new Map(),
      isCollaborationEnabled: true,

      // Set complete thread state
      setThreadState: (state: ThreadState | null) => {
        set({ threadState: state });
      },

      // Update partial thread state
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

      // Set document list
      setDocuments: (documents: DocumentInfo[]) => {
        set({ documents });
      },

      // Add document
      addDocument: (document: DocumentInfo) => {
        set((state) => ({
          documents: [...state.documents, document],
        }));
      },

      // Update document
      updateDocument: (documentId: string, updates: Partial<DocumentInfo>) => {
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.document_id === documentId ? { ...doc, ...updates } : doc
          ),
        }));
      },

      // Remove document
      removeDocument: (documentId: string) => {
        const state = get();

        // Clean up collaboration service
        const collaborationService =
          state.collaborationServices.get(documentId);
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
          // Clear selection if the removed document is currently selected
          selectedDocumentId:
            state.selectedDocumentId === documentId
              ? null
              : state.selectedDocumentId,
        }));
      },

      // Set selected document
      setSelectedDocument: (documentId: string | null) => {
        set({ selectedDocumentId: documentId });
      },

      // Initialize collaboration service
      initializeCollaboration: async (documentId: string, userId?: string) => {
        const state = get();

        // Check if service already exists
        if (state.collaborationServices.has(documentId)) {
          return state.collaborationServices.get(documentId)!;
        }

        try {
          const collaborationService = new CollaborationService(
            `document-${documentId}`,
            userId,
            "ws://localhost:1234"
          );

          // Set up event listeners
          collaborationService.onConnectionStatusChange((status) => {
            get().updateConnectionStatus(documentId, status);
          });

          collaborationService.onUsersUpdate((users) => {
            get().updateOnlineUsers(documentId, users);
          });

          collaborationService.onContentUpdate((content) => {
            // Can implement automatic content saving here
            console.log(
              `📝 Document ${documentId} content updated:`,
              content.length,
              "characters"
            );
          });

          collaborationService.onErrorOccurred((error) => {
            console.error(
              `🔴 Collaboration error for document ${documentId}:`,
              error
            );
          });

          // Store service
          state.collaborationServices.set(documentId, collaborationService);

          return collaborationService;
        } catch (error) {
          console.error("Failed to initialize collaboration:", error);
          throw error;
        }
      },

      // Destroy collaboration service
      destroyCollaboration: (documentId: string) => {
        const state = get();
        const collaborationService =
          state.collaborationServices.get(documentId);

        if (collaborationService) {
          collaborationService.destroy();
          state.collaborationServices.delete(documentId);
          state.connectionStatuses.delete(documentId);
          state.onlineUsers.delete(documentId);

          set({
            collaborationServices: new Map(state.collaborationServices),
            connectionStatuses: new Map(state.connectionStatuses),
            onlineUsers: new Map(state.onlineUsers),
          });
        }
      },

      // Get collaboration service
      getCollaborationService: (documentId: string) => {
        const state = get();
        return state.collaborationServices.get(documentId) || null;
      },

      // Update connection status
      updateConnectionStatus: (
        documentId: string,
        status: ConnectionStatus
      ) => {
        const state = get();
        state.connectionStatuses.set(documentId, status);

        set({
          connectionStatuses: new Map(state.connectionStatuses),
        });
      },

      // Update online users
      updateOnlineUsers: (documentId: string, users: CollaborationUser[]) => {
        const state = get();
        state.onlineUsers.set(documentId, users);

        // Also update the document's active user list
        get().updateDocument(documentId, {
          active_agents: users.map((user) => user.name),
        });

        set({
          onlineUsers: new Map(state.onlineUsers),
        });
      },

      // Set collaboration feature toggle
      setCollaborationEnabled: (enabled: boolean) => {
        set({ isCollaborationEnabled: enabled });
      },

      // Get document content
      getDocumentContent: (documentId: string) => {
        const state = get();
        const collaborationService =
          state.collaborationServices.get(documentId);

        if (collaborationService) {
          return collaborationService.getContent();
        }

        // If no collaboration service, return empty content or get from elsewhere
        return "";
      },

      // Save document content
      saveDocumentContent: async (documentId: string, content: string) => {
        try {
          // Can implement logic to save content to server here
          console.log(
            `💾 Saving document ${documentId} with ${content.length} characters`
          );

          // Simulate save operation
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Update document's last modified time
          get().updateDocument(documentId, {
            last_modified: new Date().toISOString(),
            version:
              (get().documents.find((doc) => doc.document_id === documentId)
                ?.version || 0) + 1,
          });

          return true;
        } catch (error) {
          console.error("Failed to save document:", error);
          return false;
        }
      },

      // Create new document
      createDocument: async (name: string, content: string = "") => {
        try {
          const documentId = `doc-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;
          const now = new Date().toISOString();

          const newDocument: DocumentInfo = {
            document_id: documentId,
            name: name,
            creator: "current-user", // Should get from user state
            created: now,
            last_modified: now,
            version: 1,
            active_agents: [],
            permission: "read_write",
          };

          // Add to document list
          get().addDocument(newDocument);

          // If there's initial content, set it
          if (content && get().isCollaborationEnabled) {
            const collaborationService = await get().initializeCollaboration(
              documentId
            );
            collaborationService.setInitialContent(content);
          }

          return documentId;
        } catch (error) {
          console.error("Failed to create document:", error);
          return null;
        }
      },
    }),
    {
      name: "openagents_documents", // localStorage key
      partialize: (state) => ({
        // Persist version number and basic state, don't persist document list (ensure all users see same default documents)
        version: state.version,
        threadState: state.threadState,
        // documents: state.documents, // Removed document list persistence, let all users see the same public documents
        selectedDocumentId: state.selectedDocumentId,
        isCollaborationEnabled: state.isCollaborationEnabled,
      }),
    }
  )
);
