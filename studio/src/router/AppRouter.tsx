import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "@/context/ToastContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import RouteGuard from "./RouteGuard";
import { routes, specialRoutes } from "./routeConfig";
import RootLayout from "@/components/layout/RootLayout";

// 创建受保护路由的包装器组件
const ProtectedRoutes: React.FC = () => {
  // 获取需要认证的路由（登录后的页面）
  const protectedRoutes = routes.filter((route) => route.requiresAuth);

  return (
    <Routes>
      {protectedRoutes.map(({ path, element: Component, requiresLayout }) => (
        <Route
          key={path}
          path={path}
          element={
            <RouteGuard>
              {requiresLayout ? (
                <RootLayout>
                  <Component />
                </RootLayout>
              ) : (
                <Component />
              )}
            </RouteGuard>
          }
        />
      ))}
    </Routes>
  );
};

const AppRouter: React.FC = () => {
  // 获取不需要认证的路由（登录页面）
  const publicRoutes = routes.filter((route) => !route.requiresAuth);

  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            {publicRoutes.map(
              ({ path, element: Component, requiresLayout }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <RouteGuard>
                      {requiresLayout ? (
                        <RootLayout>
                          <Component />
                        </RootLayout>
                      ) : (
                        <Component />
                      )}
                    </RouteGuard>
                  }
                />
              )
            )}

            <Route path="/*" element={<ProtectedRoutes />} />

            {/* 特殊路由（重定向等） */}
            {specialRoutes.map(({ path, element: Element }) => (
              <Route key={path} path={path} element={<Element />} />
            ))}
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default AppRouter;
