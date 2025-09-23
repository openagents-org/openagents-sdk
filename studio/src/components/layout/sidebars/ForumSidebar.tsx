import React from "react";

// Section Header Component
const SectionHeader: React.FC<{ title: string }> = React.memo(({ title }) => (
  <div className="px-5 my-3">
    <div className="flex items-center">
      <div className="text-xs font-bold text-gray-400 tracking-wide select-none">
        {title}
      </div>
      <div className="ml-2 h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
    </div>
  </div>
));
SectionHeader.displayName = "SectionHeader";

// Forum Category Item Component
const ForumCategoryItem: React.FC<{
  name: string;
  isActive: boolean;
  unreadCount?: number;
  onClick: () => void;
}> = React.memo(({ name, isActive, unreadCount = 0, onClick }) => (
  <li>
    <button
      onClick={onClick}
      className={`w-full text-left text-sm truncate px-2 py-2 font-medium rounded transition-colors
        ${
          isActive
            ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 border-l-2 border-indigo-500 dark:border-indigo-400 pl-2 shadow-sm"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 pl-2.5"
        }
      `}
      title={name}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <span className="mr-2 text-gray-400">💬</span>
          <span className="truncate">{name}</span>
        </div>
        {unreadCount > 0 && (
          <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    </button>
  </li>
));
ForumCategoryItem.displayName = "ForumCategoryItem";

// Forum Topic Item Component
const ForumTopicItem: React.FC<{
  name: string;
  isActive: boolean;
  unreadCount?: number;
  onClick: () => void;
}> = React.memo(({ name, isActive, unreadCount = 0, onClick }) => (
  <li>
    <button
      onClick={onClick}
      className={`w-full text-left text-sm truncate px-2 py-2 font-medium rounded transition-colors
        ${
          isActive
            ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 border-l-2 border-indigo-500 dark:border-indigo-400 pl-2 shadow-sm"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 pl-2.5"
        }
      `}
      title={name}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <span className="mr-2 text-gray-400">📝</span>
          <span className="truncate">{name}</span>
        </div>
        {unreadCount > 0 && (
          <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    </button>
  </li>
));
ForumTopicItem.displayName = "ForumTopicItem";

// Forum Sidebar Content Component
const ForumSidebar: React.FC = () => {
  // TODO: 这里应该从 forumStore 或相关的 store 获取论坛数据
  // 目前使用模拟数据
  const forumCategories = [
    { name: "General Discussion", id: "general" },
    { name: "Q&A", id: "qa" },
    { name: "Feature Requests", id: "features" },
    { name: "Bug Reports", id: "bugs" },
  ];

  const popularTopics = [
    { name: "Welcome to Forum", id: "welcome" },
    { name: "Forum Guidelines", id: "guidelines" },
    { name: "Getting Started", id: "getting-started" },
  ];

  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const [activeTopic, setActiveTopic] = React.useState<string | null>(null);

  // TODO: 实现 unreadCounts 逻辑
  const unreadCounts: Record<string, number> = {
    general: 5,
    qa: 2,
    welcome: 1,
  };

  // 分类选择处理
  const onCategorySelect = (categoryId: string) => {
    setActiveCategory(categoryId);
    setActiveTopic(null); // 切换分类时清除话题选择
  };

  // 话题选择处理
  const onTopicSelect = (topicId: string) => {
    setActiveTopic(topicId);
    setActiveCategory(null); // 切换话题时清除分类选择
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Forum Categories Section */}
      <SectionHeader title="CATEGORIES" />
      <div className="px-3">
        <ul className="flex flex-col gap-1">
          {forumCategories.map((category) => (
            <ForumCategoryItem
              key={category.id}
              name={category.name}
              isActive={activeCategory === category.id}
              unreadCount={unreadCounts[category.id] || 0}
              onClick={() => onCategorySelect(category.id)}
            />
          ))}
        </ul>
      </div>

      {/* Popular Topics Section */}
      <SectionHeader title="POPULAR TOPICS" />
      <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
        <ul className="flex flex-col gap-1">
          {popularTopics.map((topic) => (
            <ForumTopicItem
              key={topic.id}
              name={topic.name}
              isActive={activeTopic === topic.id}
              unreadCount={unreadCounts[topic.id] || 0}
              onClick={() => onTopicSelect(topic.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default React.memo(ForumSidebar);