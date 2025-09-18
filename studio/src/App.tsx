import React, { useState, useEffect, useCallback, useRef } from "react";
import MainLayout from "./components/layout/MainLayout";
import ChatView from "./components/chat/ChatView";
import NetworkSelectionView from "./components/network/NetworkSelectionView";
import AgentNamePicker from "./components/network/AgentNamePicker";
import McpView from "./components/mcp/McpView";
import { DocumentsView, ForumView, WikiView } from "./components";
import useConversation from "./hooks/useConversation";
import useTheme from "./hooks/useTheme";
import { ToastProvider } from "./context/ToastContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { DocumentInfo } from "./types";

// Updated Thread Messaging with new event system
import { useOpenAgents } from "./hooks/useOpenAgents";
import { ThreadChannel, AgentInfo } from "./types/events";
import ThreadMessagingViewEventBased from "./components/chat/ThreadMessagingViewEventBased";

import ConnectionLoadingPage from "@/pages/connection/ConnectionLoadingPage";
import { useNetworkStore } from "@/stores/networkStore";
import { clearAllOpenAgentsData } from "@/utils/cookies";
import { getForumModStatus } from "./services/forumService";
import { getWikiModStatus } from "./services/wikiService";

// Thread state for compatibility with existing UI
export interface ThreadState {
  channels?: ThreadChannel[];
  agents?: AgentInfo[];
  currentChannel?: string | null;
  currentDirectMessage?: string | null;
}

// App main component
const AppContent: React.FC = () => {
  const { selectedNetwork, agentName, clearAgentName, clearNetwork } =
    useNetworkStore();

  const [activeView, setActiveView] = useState<
    "chat" | "settings" | "profile" | "mcp" | "documents" | "forum" | "wiki"
  >("chat");

  const [threadState, setThreadState] = useState<ThreadState | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );

  // Use the new event system when we have network connection
  // Only initialize when we have real values, not fallbacks
  const openAgentsHook = useOpenAgents({
    agentId: agentName || "studio_user",
    host: selectedNetwork?.host,
    port: selectedNetwork?.port,
    autoConnect: !!selectedNetwork && !!agentName,
  });

  const { connectionStatus, channels } = openAgentsHook;

  // Determine if we're connected
  const isConnected = connectionStatus.status === "connected";

  // Determine if we have thread messaging (always true with new system)
  const hasThreadMessaging = true;
  const hasSharedDocuments = true; // Assume documents are available
  
  // Check for forum mod availability
  const [hasForum, setHasForum] = useState(false);
  const [popularTopics, setPopularTopics] = useState<any[]>([]);
  const [isLoadingPopularTopics, setIsLoadingPopularTopics] = useState(false);
  
  // Check for wiki mod availability
  const [hasWiki, setHasWiki] = useState(false);
  
  useEffect(() => {
    const checkMods = async () => {
      if (openAgentsHook.service) {
        try {
          const healthResponse = await openAgentsHook.service.getNetworkHealth();
          // The health data might be nested under 'data' property
          const healthData = healthResponse.data || healthResponse;
          
          const forumStatus = getForumModStatus(healthData);
          setHasForum(forumStatus.available);
          
          const wikiStatus = getWikiModStatus(healthData);
          setHasWiki(wikiStatus.available);
          
          console.log('Mod detection:', { healthData, forumStatus, wikiStatus });
        } catch (error) {
          console.error('Failed to check mod status:', error);
          setHasForum(false);
          setHasWiki(false);
        }
      }
    };

    if (isConnected) {
      checkMods();
    }
  }, [isConnected, openAgentsHook.service]);

  // Load popular topics when forum is available
  useEffect(() => {
    const loadPopularTopics = async () => {
      if (hasForum && openAgentsHook.service) {
        try {
          setIsLoadingPopularTopics(true);
          const response = await openAgentsHook.service.sendEvent({
            event_name: 'forum.popular.topics',
            source_id: openAgentsHook.service.getAgentId(),
            destination_id: 'mod:openagents.mods.workspace.forum',
            payload: {
              query_type: 'popular_topics',
              limit: 5,
              offset: 0,
              sort_by: 'recent'
            }
          });

          if (response.success && response.data) {
            setPopularTopics(response.data.topics || []);
          }
          setIsLoadingPopularTopics(false);
        } catch (error) {
          console.error('Failed to load popular topics:', error);
          setIsLoadingPopularTopics(false);
        }
      }
    };

    if (hasForum) {
      loadPopularTopics();
    }
  }, [hasForum, openAgentsHook.service]);

  const threadMessagingRef = useRef<{
    getState: () => ThreadState;
    selectChannel: (channel: string) => void;
    selectDirectMessage: (agentId: string) => void;
  } | null>(null);

  // Handle thread state changes
  const handleThreadStateChange = useCallback((newState: ThreadState) => {
    setThreadState(newState);
  }, []);

  const {
    activeConversationId,
    conversations,
    handleConversationChange,
    createNewConversation,
    deleteConversation,
  } = useConversation();

  const { theme, toggleTheme } = useTheme();

  // Add debug function to window for troubleshooting
  useEffect(() => {
    clearNetwork();
    clearAgentName();

    (window as any).clearOpenAgentsData = clearAllOpenAgentsData;
    console.log(
      "🔧 Debug: Run clearOpenAgentsData() in console to clear all saved data"
    );
  }, [clearNetwork, clearAgentName]);

  // Enhanced createNewConversation function that always shows chat view
  const createNewConversationAndShowChat = useCallback(() => {
    createNewConversation();
    setActiveView("chat");
  }, [createNewConversation]);

  // Enhanced conversation change function that always shows chat view
  const handleConversationChangeAndShowChat = useCallback(
    (id: string) => {
      handleConversationChange(id);
      setActiveView("chat");
    },
    [handleConversationChange]
  );

  // Get current thread state from ref or fallback to basic state
  const getCurrentThreadState = useCallback((): ThreadState | null => {
    if (threadMessagingRef.current) {
      return threadMessagingRef.current.getState();
    }
    return {
      channels: channels || [],
      agents: [],
      currentChannel: null,
      currentDirectMessage: null,
    };
  }, [channels]);

  // Thread messaging handlers
  const handleChannelSelect = useCallback((channel: string) => {
    threadMessagingRef.current?.selectChannel(channel);
  }, []);

  const handleDirectMessageSelect = useCallback((agentId: string) => {
    threadMessagingRef.current?.selectDirectMessage(agentId);
  }, []);

  // Document selection handler
  const handleDocumentSelect = useCallback((documentId: string | null) => {
    setSelectedDocumentId(documentId);
    if (documentId) {
      setActiveView("documents");
    }
  }, []);

  // Forum topic selection handler
  const handleForumTopicSelect = useCallback((topicId: string) => {
    setActiveView("forum");
    // TODO: Navigate to specific topic in forum view
  }, []);

  // Step One Page - Show network selection if no network is selected
  if (!selectedNetwork) {
    return <NetworkSelectionView />;
  }

  // Step Two Page - Show agent name picker if network is selected but no agent name
  if (selectedNetwork && !agentName) {
    return <AgentNamePicker />;
  }

  // Step Three Page - Show loading if we have network and agent name but not yet connected
  if (!isConnected) {
    return <ConnectionLoadingPage connectionStatus={connectionStatus} />;
  }

  // Show the original UI with thread messaging
  return (
    <ToastProvider>
      <ConfirmProvider>
        <MainLayout
          activeView={activeView}
          setActiveView={setActiveView}
          activeConversationId={activeConversationId}
          conversations={conversations}
          onConversationChange={handleConversationChangeAndShowChat}
          createNewConversation={createNewConversationAndShowChat}
          currentNetwork={selectedNetwork}
          currentTheme={theme}
          toggleTheme={toggleTheme}
          hasSharedDocuments={hasSharedDocuments}
          hasThreadMessaging={hasThreadMessaging}
          hasForum={hasForum}
          hasWiki={hasWiki}
          agentName={agentName}
          // Forum props
          popularTopics={popularTopics}
          isLoadingPopularTopics={isLoadingPopularTopics}
          onForumTopicSelect={handleForumTopicSelect}
          threadState={getCurrentThreadState()}
          onChannelSelect={handleChannelSelect}
          onDirectMessageSelect={handleDirectMessageSelect}
          // Documents props
          documents={documents}
          onDocumentSelect={handleDocumentSelect}
          selectedDocumentId={selectedDocumentId}
        >
          {activeView === "chat" ? (
            hasThreadMessaging ? (
              // Use the new thread messaging with event system
              <ThreadMessagingViewEventBased
                ref={threadMessagingRef}
                openAgentsHook={openAgentsHook}
                agentName={agentName!}
                currentTheme={theme}
                onProfileClick={() => setActiveView("profile")}
                toggleTheme={toggleTheme}
                hasSharedDocuments={hasSharedDocuments}
                onDocumentsClick={() => setActiveView("documents")}
                onThreadStateChange={handleThreadStateChange}
              />
            ) : (
              // Fallback to regular chat
              <ChatView
                conversationId={activeConversationId}
                onDeleteConversation={() => {
                  deleteConversation(activeConversationId);
                  createNewConversation();
                }}
                currentTheme={theme}
              />
            )
          ) : activeView === "documents" ? (
            <DocumentsView
              currentTheme={theme}
              onBackClick={() => setActiveView("chat")}
              documents={documents}
              selectedDocumentId={selectedDocumentId}
              onDocumentSelect={handleDocumentSelect}
              onDocumentsChange={setDocuments}
            />
          ) : activeView === "settings" ? (
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-4">Settings</h1>
              <p>Settings panel coming soon...</p>
            </div>
          ) : activeView === "profile" ? (
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-4">Profile</h1>
              <p>Profile panel coming soon...</p>
            </div>
          ) : activeView === "mcp" ? (
            <McpView onBackClick={() => setActiveView("chat")} />
          ) : activeView === "forum" ? (
            <ForumView 
              onBackClick={() => setActiveView("chat")} 
              currentTheme={theme}
              connection={openAgentsHook.service}
            />
          ) : activeView === "wiki" ? (
            <WikiView 
              onBackClick={() => setActiveView("chat")} 
              currentTheme={theme}
              connection={openAgentsHook.service}
            />
          ) : null}
        </MainLayout>
      </ConfirmProvider>
    </ToastProvider>
  );
};

// Main App component
const App: React.FC = () => {
  return <AppContent />;
};

export default App;
