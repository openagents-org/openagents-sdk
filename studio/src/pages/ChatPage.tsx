import React, { useRef, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import ChatView from "../components/chat/ChatView";
import ThreadMessagingViewEventBased from "../components/chat/ThreadMessagingViewEventBased";
import { DocumentsView } from "../components";
import McpView from "../components/mcp/McpView";

import { useConversationStore } from "../stores/conversationStore";
import { useThreadStore } from "../stores/threadStore";
import { useViewStore } from "../stores/viewStore";
import { useNetworkStore } from "../stores/networkStore";
import useConnectedStatus from "../hooks/useConnectedStatus";
import { PLUGIN_NAME_ENUM } from "../types/plugins";
import { ThreadState } from "@/types/thread";

const ChatPage: React.FC = () => {
  const { selectedNetwork, agentName } = useNetworkStore();
  const { isConnected, channels, openAgentsHook } = useConnectedStatus();
  const { activeView, setActiveView } = useViewStore();

  const {
    activeConversationId,
    conversations,
    handleConversationChange,
    createNewConversation,
    deleteConversation,
  } = useConversationStore();

  const {
    threadState,
    documents,
    selectedDocumentId,
    setSelectedDocument,
    setDocuments,
    setThreadState,
  } = useThreadStore();

  // 线程消息引用
  const threadMessagingRef = useRef<{
    getState: () => ThreadState;
    selectChannel: (channel: string) => void;
    selectDirectMessage: (agentId: string) => void;
  } | null>(null);

  // 获取当前线程状态
  const getCurrentThreadState = useCallback((): ThreadState | null => {
    if (threadMessagingRef.current) {
      return threadMessagingRef.current.getState();
    }
    return (
      threadState || {
        channels: channels || [],
        agents: [],
        currentChannel: null,
        currentDirectMessage: null,
      }
    );
  }, [channels, threadState]);

  // 线程消息处理器
  const handleChannelSelect = useCallback((channel: string) => {
    threadMessagingRef.current?.selectChannel(channel);
  }, []);

  const handleDirectMessageSelect = useCallback((agentId: string) => {
    threadMessagingRef.current?.selectDirectMessage(agentId);
  }, []);

  // 文档选择处理器
  const handleDocumentSelect = useCallback(
    (documentId: string | null) => {
      setSelectedDocument(documentId);
      if (documentId) {
        setActiveView(PLUGIN_NAME_ENUM.DOCUMENTS);
      }
    },
    [setSelectedDocument, setActiveView]
  );

  // 线程状态变化处理器
  const handleThreadStateChange = useCallback(
    (newState: ThreadState) => {
      setThreadState(newState);
    },
    [setThreadState]
  );

  // 增强的对话创建函数
  const createNewConversationAndShowChat = useCallback(() => {
    createNewConversation();
    setActiveView(PLUGIN_NAME_ENUM.CHAT);
  }, [createNewConversation, setActiveView]);

  // 增强的对话切换函数
  const handleConversationChangeAndShowChat = useCallback(
    (id: string) => {
      handleConversationChange(id);
      setActiveView(PLUGIN_NAME_ENUM.CHAT);
    },
    [handleConversationChange, setActiveView]
  );

  const hasThreadMessaging = true;
  const hasSharedDocuments = true;

  return (
    <MainLayout
      activeConversationId={activeConversationId}
      conversations={conversations}
      onConversationChange={handleConversationChangeAndShowChat}
      createNewConversation={createNewConversationAndShowChat}
      hasSharedDocuments={hasSharedDocuments}
      hasThreadMessaging={hasThreadMessaging}
      threadState={getCurrentThreadState()}
      onChannelSelect={handleChannelSelect}
      onDirectMessageSelect={handleDirectMessageSelect}
      documents={documents}
      onDocumentSelect={handleDocumentSelect}
      selectedDocumentId={selectedDocumentId}
    >
      <Routes>
        {/* Default chat route */}
        <Route
          index
          element={
            hasThreadMessaging ? (
              <ThreadMessagingViewEventBased
                ref={threadMessagingRef}
                openAgentsHook={openAgentsHook}
                agentName={agentName!}
                onProfileClick={() => setActiveView(PLUGIN_NAME_ENUM.PROFILE)}
                hasSharedDocuments={hasSharedDocuments}
                onDocumentsClick={() =>
                  setActiveView(PLUGIN_NAME_ENUM.DOCUMENTS)
                }
                onThreadStateChange={handleThreadStateChange}
              />
            ) : (
              <ChatView
                conversationId={activeConversationId}
                onDeleteConversation={() => {
                  deleteConversation(activeConversationId);
                  createNewConversation();
                }}
              />
            )
          }
        />

        {/* Documents route */}
        <Route
          path="documents"
          element={
            <DocumentsView
              onBackClick={() => setActiveView(PLUGIN_NAME_ENUM.CHAT)}
              documents={documents}
              selectedDocumentId={selectedDocumentId}
              onDocumentSelect={handleDocumentSelect}
              onDocumentsChange={setDocuments}
            />
          }
        />

        {/* Settings route */}
        <Route
          path="settings"
          element={
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Settings panel coming soon...
              </p>
            </div>
          }
        />

        {/* Profile route */}
        <Route
          path="profile"
          element={
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Profile
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Profile panel coming soon...
              </p>
            </div>
          }
        />

        {/* MCP route */}
        <Route
          path="mcp"
          element={
            <McpView onBackClick={() => setActiveView(PLUGIN_NAME_ENUM.CHAT)} />
          }
        />
      </Routes>
    </MainLayout>
  );
};

export default ChatPage;
