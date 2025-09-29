import React, { ReactNode, useContext } from "react";
import ModSidebar from "./ModSidebar";
import Sidebar from "./Sidebar";
import ConnectionLoadingOverlay from "@/components/common/ConnectionLoadingOverlay";
import {
  OpenAgentsProvider,
  OpenAgentsContext,
} from "@/contexts/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";
import { Navigate } from "react-router-dom";

interface RootLayoutProps {
  children: ReactNode;
}

// 条件渲染的 OpenAgents Provider 包装器
const ConditionalOpenAgentsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { selectedNetwork, agentName } = useAuthStore();

  // 只有在完成基础设置后才初始化 OpenAgentsProvider
  if (selectedNetwork && agentName) {
    console.log("🚀 RootLayout: Initializing OpenAgentsProvider", {
      network:
        selectedNetwork?.networkInfo?.name ||
        `${selectedNetwork?.host}:${selectedNetwork?.port}`,
      agentName,
    });
    return <OpenAgentsProvider>{children}</OpenAgentsProvider>;
  }

  return <Navigate to="/network-selection" />;
};

/**
 * 根布局组件 - 负责整体布局结构
 * 包含：左侧模块导航 + 中间内容区域（侧边栏 + 主内容）
 *
 * 现在还负责条件渲染 OpenAgentsProvider：
 * - 只有在用户完成网络选择和代理设置后才初始化 OpenAgentsProvider
 * - 这样确保所有使用 RootLayout 的页面都可以访问 OpenAgents context
 */
const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <ConditionalOpenAgentsProvider>
      <RootLayoutContent>{children}</RootLayoutContent>
    </ConditionalOpenAgentsProvider>
  );
};

// 实际的布局内容组件
const RootLayoutContent: React.FC<RootLayoutProps> = ({ children }) => {
  const context = useContext(OpenAgentsContext);
  const isConnected = context?.isConnected || false;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* 连接状态覆盖层 - 只有在有 OpenAgentsProvider 且未连接时显示 */}
      {context && !isConnected && <ConnectionLoadingOverlay />}

      {/* 左侧模块导航栏 */}
      <ModSidebar />

      {/* 中间内容区域：侧边栏 + 主内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 功能侧边栏 - 现在是自管理的，会根据路由自动显示相应内容 */}
        <Sidebar />

        {/* 主内容区域 */}
        <main className="flex-1 flex flex-col overflow-hidden m-1 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:bg-gray-800">
          {children}
        </main>
      </div>
    </div>
  );
};

export default RootLayout;
