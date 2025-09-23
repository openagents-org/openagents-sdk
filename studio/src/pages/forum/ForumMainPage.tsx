import React from "react";
import { Routes, Route } from "react-router-dom";

/**
 * 论坛主页面 - 处理论坛相关的所有功能
 */
const ForumMainPage: React.FC = () => {

  return (
    <Routes>
      {/* 默认论坛视图 */}
      <Route
        index
        element={
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Forum
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Forum discussions will appear here
              </p>
            </div>
          </div>
        }
      />

      {/* 其他论坛相关的子路由可以在这里添加 */}
    </Routes>
  );
};

export default ForumMainPage;