import React from "react";
import { Routes, Route } from "react-router-dom";
import ForumTopicList from "@/components/forum/ForumTopicList";
import ForumTopicDetail from "@/components/forum/ForumTopicDetail";

/**
 * Forum main page - Handle all Forum-related features
 */
const ForumMainPage: React.FC = () => {
  return (
    <div className="h-full dark:bg-gray-800">
      <Routes>
        {/* Topic list page */}
        <Route
          index
          element={<ForumTopicList />}
        />

        {/* Topic detail page */}
        <Route
          path=":topicId"
          element={<ForumTopicDetail />}
        />
      </Routes>
    </div>
  );
};

export default ForumMainPage;