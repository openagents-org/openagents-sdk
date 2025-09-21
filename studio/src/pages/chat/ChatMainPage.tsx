import React, { useCallback, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import ThreadMessagingViewEventBased from "@/components/chat/ThreadMessagingViewEventBased";
import ChatView from "@/components/chat/ChatView";
import { useConversationStore } from "@/stores/conversationStore";
import { useThreadStore } from "@/stores/threadStore";
import { useNetworkStore } from "@/stores/networkStore";
import { useSharedConnection } from "@/router/RouteGuard";
import { ThreadState } from "@/types/thread";
/**
 * 聊天主页面 - 处理聊天相关的所有功能
 */
const ChatMainPage: React.FC = () => {
  const { agentName } = useNetworkStore();
  const { channels, openAgentsHook } = useSharedConnection();

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

  // 线程状态变化处理器
  const handleThreadStateChange = useCallback(
    (newState: ThreadState) => {
      setThreadState(newState);
    },
    [setThreadState]
  );

  // 文档选择处理器
  const handleDocumentSelect = useCallback(
    (documentId: string | null) => {
      setSelectedDocument(documentId);
    },
    [setSelectedDocument]
  );
  const {
    activeConversationId,
    conversations,
    handleConversationChange,
    createNewConversation,
    deleteConversation,
  } = useConversationStore();

  // 线程消息处理器
  const handleChannelSelect = useCallback((channel: string) => {
    threadMessagingRef.current?.selectChannel(channel);
  }, [threadMessagingRef]);

  const handleDirectMessageSelect = useCallback((agentId: string) => {
    threadMessagingRef.current?.selectDirectMessage(agentId);
  }, [threadMessagingRef]);

  // 判断是否使用线程消息系统
  const hasThreadMessaging = true;

  return (
    <Routes>
      {/* 默认聊天视图 */}
      <Route
        index
        element={
          hasThreadMessaging ? (
            <ThreadMessagingViewEventBased
              ref={threadMessagingRef}
              openAgentsHook={openAgentsHook}
              agentName={agentName!}
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

      {/* 其他聊天相关的子路由可以在这里添加 */}
    </Routes>
  );
};

export default ChatMainPage;