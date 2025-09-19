import React from "react";
import RouteGuard from "./RouteGuard";

interface ProtectedRouteProps {
  component: React.ComponentType;
}

/**
 * 包装组件，自动为所有路由添加 RouteGuard 保护
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ component: Component }) => {
  return (
    <RouteGuard>
      <Component />
    </RouteGuard>
  );
};

export default ProtectedRoute;