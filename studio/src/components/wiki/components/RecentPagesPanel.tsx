import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentPagesStore } from '@/stores/recentPagesStore';
import { WikiPage } from '@/stores/wikiStore';
import { formatDateTime } from '@/utils/utils';

interface RecentPagesPanelProps {
  className?: string;
  currentPages: WikiPage[]; // 当前wiki列表，用于过滤
}

const RecentPagesPanel: React.FC<RecentPagesPanelProps> = ({ className = '', currentPages }) => {
  const navigate = useNavigate();
  const { recentPages, clearRecentPages, removeRecentPage } = useRecentPagesStore();

  // 过滤recent pages，只显示在当前pages列表中存在的页面
  const validRecentPages = useMemo(() => {
    const currentPagePaths = new Set(currentPages.map(p => p.page_path));
    return recentPages.filter(recentPage => currentPagePaths.has(recentPage.page_path));
  }, [recentPages, currentPages]);

  const handlePageClick = (pagePath: string) => {
    navigate(`/wiki/detail/${encodeURIComponent(pagePath)}`);
  };

  const handleClearAll = () => {
    if (validRecentPages.length > 0) {
      clearRecentPages();
    }
  };

  // 可选：自动清理无效的recent pages
  const handleCleanupInvalid = () => {
    const currentPagePaths = new Set(currentPages.map(p => p.page_path));
    const invalidPages = recentPages.filter(recentPage => !currentPagePaths.has(recentPage.page_path));

    invalidPages.forEach(page => {
      removeRecentPage(page.page_path);
    });
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Recent Pages
          </h3>
          <div className="flex items-center space-x-2">
            {recentPages.length > validRecentPages.length && (
              <button
                onClick={handleCleanupInvalid}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                title={`Clean up ${recentPages.length - validRecentPages.length} invalid pages`}
              >
                Clean
              </button>
            )}
            {validRecentPages.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {validRecentPages.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No recent pages
          </div>
        ) : (
          <div className="py-2">
            {validRecentPages.map((page) => (
              <div
                key={page.page_path}
                onClick={() => handlePageClick(page.page_path)}
                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {page.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                      {page.page_path}
                    </p>
                    {page.preview_content && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                        {page.preview_content}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDateTime(page.visited_at / 1000)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {validRecentPages.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Showing {validRecentPages.length} of 10 recent pages
            {recentPages.length > validRecentPages.length && (
              <span className="text-amber-500"> ({recentPages.length - validRecentPages.length} invalid)</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default RecentPagesPanel;