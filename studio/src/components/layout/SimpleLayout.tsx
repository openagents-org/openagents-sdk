import React, { ReactNode, useContext } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import {
  OpenAgentsProvider,
  OpenAgentsContext,
} from "@/context/OpenAgentsProvider";
import { useAuthStore } from "@/stores/authStore";

interface SimpleLayoutProps {
  children?: ReactNode;
}

// Conditionally rendered OpenAgents Provider wrapper
const ConditionalOpenAgentsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { selectedNetwork, agentName } = useAuthStore();

  // Only initialize OpenAgentsProvider after basic setup is complete
  if (selectedNetwork && agentName) {
    return <OpenAgentsProvider>{children}</OpenAgentsProvider>;
  }

  // If no network/agent selected, render children without provider
  // (Sidebar will handle this gracefully or won't be shown)
  return <>{children}</>;
};

/**
 * SimpleLayout - 简易的包裹布局组件
 * 用于包裹 dynamicRouteConfig 中的所有路由
 * 使用 Outlet 渲染子路由，确保路由切换时不会重新渲染整个布局
 */
const SimpleLayout: React.FC<SimpleLayoutProps> = ({ children }) => {
  return (
    <ConditionalOpenAgentsProvider>
      <SimpleLayoutContent>{children}</SimpleLayoutContent>
    </ConditionalOpenAgentsProvider>
  );
};

// Internal component that can access OpenAgentsContext
const SimpleLayoutContent: React.FC<SimpleLayoutProps> = ({ children }) => {
  const context = useContext(OpenAgentsContext);
  const { selectedNetwork, agentName } = useAuthStore();

  // Only show Sidebar if we have network/agent and context is available
  const shouldShowSidebar = selectedNetwork && agentName && context;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F4F4F5] dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      {shouldShowSidebar && <Sidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {children ? children : <Outlet />}
        </div>
      </div>
    </div>
  );
};

export default SimpleLayout;
