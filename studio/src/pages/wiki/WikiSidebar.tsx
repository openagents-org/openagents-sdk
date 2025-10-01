import React, { useEffect, useMemo, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWikiStore } from "@/stores/wikiStore";
import { useRecentPagesStore } from "@/stores/recentPagesStore";
import { OpenAgentsContext } from "@/context/OpenAgentsProvider";

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

// Wiki Page Item Component
const WikiPageItem: React.FC<{
  page: {
    page_path: string;
    title: string;
    last_modified: number;
  };
  isActive: boolean;
  onClick: () => void;
}> = React.memo(({ page, isActive, onClick }) => {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left text-sm px-2 py-2 font-medium rounded transition-colors
          ${
            isActive
              ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 border-l-2 border-indigo-500 dark:border-indigo-400 pl-2 shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 pl-2.5"
          }
        `}
        title={page.title}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start min-w-0 flex-1">
            <span className="mr-2 text-gray-400 mt-0.5">📄</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center truncate font-medium overflow-hidden">
                <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {page.title}
                </div>
              </div>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
});
WikiPageItem.displayName = "WikiPageItem";

// Wiki Sidebar Content Component
const WikiSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const context = useContext(OpenAgentsContext);
  const openAgentsService = context?.connector;
  const isConnected = context?.isConnected;
  const { recentPages: recentPagesData, addRecentPage } = useRecentPagesStore();

  const {
    pages,
    setConnection,
    loadPages,
    setupEventListeners,
    cleanupEventListeners,
  } = useWikiStore();

  // 获取最近点击访问的页面（过滤后的有效页面）
  const recentPages = useMemo(() => {
    const currentPagePaths = new Set(pages.map((p) => p.page_path));
    const validRecentPages = recentPagesData.filter((recentPage) =>
      currentPagePaths.has(recentPage.page_path)
    );

    // 将recent page data转换为WikiPage格式以保持组件兼容性
    const recentWikiPages = validRecentPages.map((recentPage) => {
      const fullPageData = pages.find(
        (p) => p.page_path === recentPage.page_path
      );
      return (
        fullPageData || {
          page_path: recentPage.page_path,
          title: recentPage.title,
          last_modified: recentPage.visited_at / 1000,
          wiki_content: recentPage.preview_content || "",
          creator_id: "unknown",
          created_at: recentPage.visited_at / 1000,
          version: 1,
        }
      );
    });

    console.log(
      "WikiSidebar: Recent clicked pages recalculated. Total recent:",
      recentPagesData.length,
      "Valid count:",
      recentWikiPages.length
    );
    return recentWikiPages;
  }, [recentPagesData, pages]);

  // 检查当前是否在某个页面详情页
  const currentPagePath = location.pathname.match(
    /^\/wiki\/detail\/(.+)$/
  )?.[1];
  const decodedCurrentPagePath = currentPagePath
    ? decodeURIComponent(currentPagePath)
    : null;

  // 设置连接
  useEffect(() => {
    if (openAgentsService) {
      setConnection(openAgentsService);
    }
  }, [openAgentsService, setConnection]);

  // 加载页面（等待连接建立）
  useEffect(() => {
    if (openAgentsService && isConnected && pages.length === 0) {
      console.log("WikiSidebar: Connection ready, loading pages");
      loadPages();
    }
  }, [openAgentsService, isConnected, loadPages, pages.length]);

  // 设置wiki事件监听器
  useEffect(() => {
    if (openAgentsService) {
      console.log("WikiSidebar: Setting up wiki event listeners");
      setupEventListeners();

      return () => {
        console.log("WikiSidebar: Cleaning up wiki event listeners");
        cleanupEventListeners();
      };
    }
  }, [openAgentsService, setupEventListeners, cleanupEventListeners]);

  // 页面选择处理
  const onPageSelect = (pagePath: string) => {
    // 先找到对应的页面对象并记录到recent pages
    const page = pages.find((p) => p.page_path === pagePath);
    if (page) {
      console.log("WikiSidebar: Adding page to recent pages:", page.title);
      addRecentPage(page);
    }

    navigate(`/wiki/detail/${encodeURIComponent(pagePath)}`);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Recent Pages Section */}
      <SectionHeader title="RECENT 10 PAGES" />
      <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
        {recentPages.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No recent pages
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {recentPages.map((page) => (
              <WikiPageItem
                key={page.page_path}
                page={page}
                isActive={decodedCurrentPagePath === page.page_path}
                onClick={() => onPageSelect(page.page_path)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default React.memo(WikiSidebar);
