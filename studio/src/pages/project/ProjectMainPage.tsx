import React from "react"
import { Routes, Route } from "react-router-dom"
import ProjectChatRoom from "@/pages/messaging/components/ProjectChatRoom"

/**
 * Project主页面
 * 路由: /project/*
 *
 * 该页面提供项目管理和私人聊天室功能
 * - 左侧：项目列表和New Project按钮
 * - 右侧：基于选中项目ID的私人聊天室
 */
const ProjectMainPage: React.FC = () => {
  return (
    <div className="h-full bg-white dark:bg-gray-900">
      <Routes>
        {/* 默认路由 - 显示项目列表和选择提示 */}
        <Route index element={<ProjectChatRoom />} />

        {/* 特定项目的聊天室 - 通过projectId参数 */}
        <Route path=":projectId" element={<ProjectChatRoom />} />
      </Routes>
    </div>
  )
}

export default ProjectMainPage
