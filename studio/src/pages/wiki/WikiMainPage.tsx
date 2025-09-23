import React from "react";
import { Routes, Route } from "react-router-dom";
import { useThemeStore } from "@/stores/themeStore";
import { useOpenAgentsService } from "@/contexts/OpenAgentsServiceContext";
import WikiView from "@/components/wiki/WikiView";

/**
 * Wiki主页面 - 处理Wiki相关的所有功能
 */
const WikiMainPage: React.FC = () => {
  const { theme } = useThemeStore();
  const { service: openAgentsService } = useOpenAgentsService();

  return (
    <Routes>
      {/* 默认Wiki视图 */}
      <Route
        index
        element={
          <WikiView
            currentTheme={theme}
            connection={openAgentsService}
          />
        }
      />

      {/* 其他Wiki相关的子路由可以在这里添加 */}
    </Routes>
  );
};

export default WikiMainPage;