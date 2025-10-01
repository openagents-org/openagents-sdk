import React, { useCallback, useMemo, useContext } from "react";
import {
  ConnectionState,
  OpenAgentsContext,
} from "@/context/OpenAgentsProvider";
import { useAuthStore } from "../../stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { clearAllOpenAgentsDataForLogout } from "@/utils/cookies";
import { useNavigate } from "react-router-dom";

const ConnectionLoadingOverlay: React.FC = () => {
  const context = useContext(OpenAgentsContext);
  const navigate = useNavigate();
  const { agentName, clearNetwork, clearAgentName } =
    useAuthStore();
  const { clearAllChatData } = useChatStore();

  const currentStatus = useMemo(
    () => context?.connectionStatus.state || ConnectionState.DISCONNECTED,
    [context?.connectionStatus.state]
  );

  const isError = useMemo(
    () => currentStatus === ConnectionState.ERROR,
    [currentStatus]
  );

  const onRetry = useCallback(async () => {
    // if (context?.connect) {
    //   await context.connect();
    // } else {
      window.location.reload();
    // }
  }, [context]);



  // 登出处理函数
  const handleLogout = async () => {
    console.log("🚪 Logout button clicked - showing confirmation dialog");

    try {
      // 清空网络状态
      clearNetwork();
      clearAgentName();
      console.log("🧹 Network state cleared");

      // 清空 chat store 数据
      clearAllChatData();
      console.log("🧹 Chat store data cleared");

      // 清空 OpenAgents 相关的所有数据（保留主题设置）
      clearAllOpenAgentsDataForLogout();

      // 跳转到网络选择页面
      console.log("🔄 Navigating to network selection");
      navigate("/network-selection", { replace: true });
    } catch (error) {
      console.error("❌ Error during logout:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        {!isError && <><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Connecting as {agentName || ""}...
        </p></>}
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Status: {currentStatus}
        </p>
        {isError && (
          <div className="mt-4">
            <p className="text-red-600 dark:text-red-400 text-sm mb-2">
              Connection failed. Please try again.
            </p>
            <div className="flex">
              <button
                onClick={() => onRetry()}
                className="mt-2 px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => handleLogout()}
                className="ml-6 mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back To Select Network
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionLoadingOverlay;
