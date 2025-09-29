import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { routes } from "./routeConfig";

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * 全局路由守卫 - 集中处理所有页面流程的路由逻辑
 * 根据当前状态确定用户应该在哪个页面
 */
const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const { selectedNetwork, agentName } = useAuthStore();
  const currentPath = location.pathname;

  console.log(
    `🛡️ RouteGuard: path=${currentPath}, network=${!!selectedNetwork}, agent=${!!agentName}`
  );

  // 处理根路径 "/" 的重定向
  if (currentPath === "/") {
    if (selectedNetwork && agentName) {
      console.log("🔄 Root path: User setup complete, redirecting to /chat");
      return <Navigate to="/chat" replace />;
    } else {
      console.log("🔄 Root path: No setup, redirecting to /network-selection");
      return <Navigate to="/network-selection" replace />;
    }
  }

  // 处理 /agent-setup 路径的访问控制
  if (currentPath === "/agent-setup") {
    if (!selectedNetwork) {
      console.log(
        "🔄 Agent setup accessed without network, redirecting to /network-selection"
      );
      return <Navigate to="/network-selection" replace />;
    }
    // 有网络选择，允许访问 agent-setup
    return <>{children}</>;
  }

  // 处理 /network-selection 路径的访问控制
  if (currentPath === "/network-selection") {
    if (selectedNetwork && agentName) {
      console.log(
        "🔄 Network selection accessed after complete setup, redirecting to /chat"
      );
      return <Navigate to="/chat" replace />;
    }
    // 没有完成设置，允许访问 network-selection
    return <>{children}</>;
  }

  // 处理需要认证的路由（ModSidebar 相关路由）
  const isAuthenticatedRoute = routes.some((route) => {
    if (!route.requiresAuth) return false;

    // 处理通配符路径 (如 "/forum/*")
    if (route.path.endsWith("/*")) {
      const basePath = route.path.slice(0, -2); // 移除 "/*"
      return currentPath === basePath || currentPath.startsWith(basePath + "/");
    }

    // 精确匹配
    return currentPath === route.path;
  });

  if (isAuthenticatedRoute) {
    // 访问认证路由，检查是否完成设置
    if (!selectedNetwork) {
      console.log(
        `🔄 Authenticated route ${currentPath} accessed without network, redirecting to /network-selection`
      );
      return <Navigate to="/network-selection" replace />;
    }

    if (!agentName) {
      console.log(
        `🔄 Authenticated route ${currentPath} accessed without agent, redirecting to /agent-setup`
      );
      return <Navigate to="/agent-setup" replace />;
    }

    // 设置完成，允许访问认证路由
    return <>{children}</>;
  }

  // 处理无效路径 - 重定向到合适的页面
  if (selectedNetwork && agentName) {
    console.log(
      `🔄 Invalid route ${currentPath} with complete setup, redirecting to /chat`
    );
    return <Navigate to="/chat" replace />;
  } else {
    console.log(
      `🔄 Invalid route ${currentPath} without setup, redirecting to /network-selection`
    );
    return <Navigate to="/network-selection" replace />;
  }
};

export default RouteGuard;
