import React from "react";
import { Routes, Route } from "react-router-dom";
import ArtifactTopicList from "@/components/artifact/ArtifactTopicList";
import ArtifactTopicDetail from "@/components/artifact/ArtifactTopicDetail";

/**
 * Artifact主页面 - 处理Artifact相关的所有功能
 */
const ArtifactMainPage: React.FC = () => {
  return (
    <div className="h-full dark:bg-gray-800">
      <Routes>
        {/* Artifact列表页 */}
        <Route
          index
          element={<ArtifactTopicList />}
        />

        {/* Artifact详情页 */}
        <Route
          path=":artifactId"
          element={<ArtifactTopicDetail />}
        />
      </Routes>
    </div>
  );
};

export default ArtifactMainPage;