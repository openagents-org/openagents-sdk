import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WikiPage } from './wikiStore';

export interface RecentPage {
  page_path: string;
  title: string;
  visited_at: number;
  preview_content?: string;
}

interface RecentPagesState {
  recentPages: RecentPage[];

  // Actions
  addRecentPage: (page: WikiPage) => void;
  clearRecentPages: () => void;
  removeRecentPage: (pagePath: string) => void;
}

const MAX_RECENT_PAGES = 10;

export const useRecentPagesStore = create<RecentPagesState>()(
  persist(
    (set, get) => ({
      recentPages: [],

      addRecentPage: (page: WikiPage) => {
        const now = Date.now();
        const recentPage: RecentPage = {
          page_path: page.page_path,
          title: page.title,
          visited_at: now,
          preview_content: page.wiki_content?.substring(0, 100) || ''
        };

        set((state) => {
          // 移除已存在的相同页面
          const filteredPages = state.recentPages.filter(
            (p) => p.page_path !== page.page_path
          );

          // 添加到顶部
          const newRecentPages = [recentPage, ...filteredPages];

          // 限制最多保留10条记录
          return {
            recentPages: newRecentPages.slice(0, MAX_RECENT_PAGES)
          };
        });
      },

      clearRecentPages: () => {
        set({ recentPages: [] });
      },

      removeRecentPage: (pagePath: string) => {
        set((state) => ({
          recentPages: state.recentPages.filter((p) => p.page_path !== pagePath)
        }));
      },
    }),
    {
      name: 'recent-pages-storage', // localStorage key
      version: 1,
    }
  )
);