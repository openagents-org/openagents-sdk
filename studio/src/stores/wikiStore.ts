import { create } from 'zustand';
import { OpenAgentsService } from '../services/openAgentsService';

// 时间戳格式检测和转换函数
const normalizeTimestamp = (timestamp: number | undefined): number => {
  if (!timestamp) return Date.now() / 1000;

  // 如果是13位毫秒级时间戳，转换为10位秒级
  if (timestamp > 1000000000000) {
    const converted = timestamp / 1000;
    console.log('WikiStore: Converting timestamp from milliseconds to seconds:', timestamp, '->', converted);
    return converted;
  }

  // 如果是10位秒级时间戳，直接返回
  console.log('WikiStore: Using timestamp as seconds:', timestamp);
  return timestamp;
};

export interface WikiPage {
  page_path: string;
  title: string;
  wiki_content: string;
  creator_id: string;
  created_at: number;
  last_modified: number;
  version: number;
}

export interface WikiEditProposal {
  proposal_id: string;
  proposed_by: string;
  created_timestamp: number;
  page_path: string;
  proposed_content: string;
  rationale: string;
  proposer_id: string;
  created_at: number;
  status: 'pending' | 'approved' | 'rejected';
}

interface WikiState {
  pages: WikiPage[];
  selectedPage: WikiPage | null;
  proposals: WikiEditProposal[];
  pagesLoading: boolean;
  pagesError: string | null;
  connection: OpenAgentsService | null;

  // Actions
  setConnection: (connection: OpenAgentsService) => void;
  loadPages: () => Promise<void>;
  loadPage: (pagePath: string) => Promise<void>;
  loadProposals: () => Promise<void>;
  searchPages: (query: string) => Promise<void>;
  createPage: (pagePath: string, title: string, content: string) => Promise<boolean>;
  editPage: (pagePath: string, content: string) => Promise<boolean>;
  proposeEdit: (pagePath: string, content: string, rationale: string) => Promise<boolean>;
  resolveProposal: (proposalId: string, action: 'approve' | 'reject') => Promise<boolean>;
  clearError: () => void;
  setSelectedPage: (page: WikiPage | null) => void;

  // Real-time updates
  updateOrAddPageToList: (page: WikiPage) => void;
  updatePageContent: (pagePath: string, content: string, lastModified?: number, version?: number) => void;

  // Event handling
  setupEventListeners: () => void;
  cleanupEventListeners: () => void;
}

export const useWikiStore = create<WikiState>((set, get) => ({
  pages: [],
  selectedPage: null,
  proposals: [],
  pagesLoading: false,
  pagesError: null,
  connection: null,

  setConnection: (connection: OpenAgentsService) => {
    set({ connection });
  },

  loadPages: async () => {
    const { connection } = get();
    if (!connection) return;

    try {
      set({ pagesLoading: true, pagesError: null });

      const response = await connection.sendEvent({
        event_name: 'wiki.pages.list',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: {
          limit: 50,
          offset: 0
        }
      });

      if (response.success && response.data) {
        set({
          pages: response.data.pages || [],
          pagesLoading: false
        });
      } else {
        set({
          pagesError: response.message || 'Failed to load wiki pages',
          pagesLoading: false
        });
      }
    } catch (err) {
      console.error('Failed to load wiki pages:', err);
      set({
        pagesError: 'Failed to load wiki pages',
        pagesLoading: false
      });
    }
  },

  loadPage: async (pagePath: string) => {
    const { connection } = get();
    if (!connection) return;

    try {
      const response = await connection.sendEvent({
        event_name: 'wiki.page.get',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: {
          page_path: pagePath
        }
      });

      if (response.success && response.data) {
        set({ selectedPage: response.data });
      }
    } catch (err) {
      console.error('Failed to load wiki page:', err);
    }
  },

  loadProposals: async () => {
    const { connection } = get();
    if (!connection) return;

    try {
      const response = await connection.sendEvent({
        event_name: 'wiki.proposals.list',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: {}
      });

      if (response.success && response.data) {
        set({ proposals: response.data.proposals || [] });
      }
    } catch (err) {
      console.error('Failed to load proposals:', err);
    }
  },

  searchPages: async (query: string) => {
    const { connection, loadPages } = get();
    if (!connection) return;

    if (!query.trim()) {
      loadPages();
      return;
    }

    try {
      const response = await connection.sendEvent({
        event_name: 'wiki.pages.search',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: {
          query: query.trim(),
          limit: 50
        }
      });

      if (response.success && response.data) {
        set({ pages: response.data.pages || [] });
      }
    } catch (err) {
      console.error('Failed to search wiki pages:', err);
    }
  },

  createPage: async (pagePath: string, title: string, content: string) => {
    const { connection } = get();
    if (!connection || !pagePath.trim() || !title.trim() || !content.trim()) return false;

    try {
      const response = await connection.sendEvent({
        event_name: 'wiki.page.create',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: {
          page_path: pagePath.trim(),
          title: title.trim(),
          wiki_content: content.trim()
        }
      });

      if (response.success) {
        // 构造新页面对象并直接添加到列表
        const newPage: WikiPage = {
          page_path: pagePath.trim(),
          title: title.trim(),
          wiki_content: content.trim(),
          creator_id: connection.getAgentId() || 'unknown',
          created_at: Date.now() / 1000,
          last_modified: Date.now() / 1000,
          version: 1
        };

        console.log('WikiStore: Creating page with data:', newPage);

        // 如果服务器返回了页面数据，使用服务器数据，否则使用本地构造的数据
        if (response.data?.page) {
          const serverPage = response.data.page;

          // 统一时间戳处理
          const createdAt = normalizeTimestamp(serverPage.created_at);
          const lastModified = normalizeTimestamp(serverPage.last_modified || serverPage.created_at);

          console.log('WikiStore: Normalized createPage server response timestamps - created_at:', createdAt, 'last_modified:', lastModified);

          const wikiPage: WikiPage = {
            page_path: serverPage.page_path,
            title: serverPage.title,
            wiki_content: serverPage.wiki_content,
            creator_id: serverPage.creator_id,
            created_at: createdAt,
            last_modified: lastModified,
            version: serverPage.version || 1
          };
          get().updateOrAddPageToList(wikiPage);
        } else {
          // 直接添加到列表顶部，无需重新加载
          get().updateOrAddPageToList(newPage);
        }

        return true;
      } else {
        // 不再设置错误状态，让UI层处理错误显示
        console.error('Failed to create wiki page:', response.message);
        return false;
      }
    } catch (err) {
      console.error('Failed to create wiki page:', err);
      // 不再设置错误状态，让UI层处理错误显示
      return false;
    }
  },

  editPage: async (pagePath: string, content: string) => {
    const { connection, loadPage, loadPages } = get();
    if (!connection || !content.trim()) return false;

    try {
      const response = await connection.sendEvent({
        event_name: 'wiki.page.edit',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: {
          page_path: pagePath,
          wiki_content: content.trim()
        }
      });

      if (response.success) {
        loadPage(pagePath);
        loadPages();
        return true;
      } else {
        set({ pagesError: response.message || 'Failed to edit wiki page' });
        return false;
      }
    } catch (err) {
      console.error('Failed to edit wiki page:', err);
      set({ pagesError: 'Failed to edit wiki page' });
      return false;
    }
  },

  proposeEdit: async (pagePath: string, content: string, rationale: string) => {
    const { connection, loadProposals } = get();
    if (!connection || !content.trim() || !rationale.trim()) return false;

    if (!pagePath || !pagePath.trim()) {
      set({ pagesError: 'Page path is required for proposals' });
      return false;
    }

    try {
      const payload = {
        page_path: pagePath.trim(),
        wiki_content: content.trim(),
        rationale: rationale.trim()
      };

      console.log('Sending proposal event with payload:', payload);

      const response = await connection.sendEvent({
        event_name: 'wiki.page.proposal.create',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: payload
      });

      if (response.success) {
        loadProposals();
        return true;
      } else {
        set({ pagesError: response.message || 'Failed to propose edit' });
        return false;
      }
    } catch (err) {
      console.error('Failed to propose edit:', err);
      set({ pagesError: 'Failed to propose edit' });
      return false;
    }
  },

  resolveProposal: async (proposalId: string, action: 'approve' | 'reject') => {
    const { connection, loadProposals, loadPages } = get();
    if (!connection) return false;

    try {
      const response = await connection.sendEvent({
        event_name: 'wiki.proposal.resolve',
        destination_id: 'mod:openagents.mods.workspace.wiki',
        payload: {
          proposal_id: proposalId,
          action: action
        }
      });

      if (response.success) {
        loadProposals();
        loadPages();
        return true;
      } else {
        set({ pagesError: response.message || `Failed to ${action} proposal` });
        return false;
      }
    } catch (err) {
      console.error(`Failed to ${action} proposal:`, err);
      set({ pagesError: `Failed to ${action} proposal` });
      return false;
    }
  },

  clearError: () => {
    set({ pagesError: null });
  },

  setSelectedPage: (page: WikiPage | null) => {
    set({ selectedPage: page });
  },

  // Real-time updates - 更新或添加页面到列表
  updateOrAddPageToList: (newPage: WikiPage) => {
    set((state) => {
      const existingIndex = state.pages.findIndex(page => page.page_path === newPage.page_path);

      if (existingIndex >= 0) {
        // 页面已存在，更新内容
        console.log('WikiStore: Updating existing page in list:', newPage.page_path);
        const updatedPages = [...state.pages];
        updatedPages[existingIndex] = newPage;

        // 如果当前选中的页面就是被更新的页面，同时更新selectedPage
        const updatedSelectedPage = state.selectedPage?.page_path === newPage.page_path
          ? newPage
          : state.selectedPage;

        return {
          ...state,
          pages: updatedPages,
          selectedPage: updatedSelectedPage
        };
      } else {
        // 页面不存在，添加到列表顶部
        console.log('WikiStore: Adding new page to list:', newPage.title);
        return {
          ...state,
          pages: [newPage, ...state.pages]
        };
      }
    });
  },

  // 专门用于更新页面内容的函数，只更新必要的字段
  updatePageContent: (pagePath: string, content: string, lastModified?: number, version?: number) => {
    set((state) => {
      const existingIndex = state.pages.findIndex(page => page.page_path === pagePath);

      if (existingIndex >= 0) {
        // 页面存在，只更新内容相关字段
        console.log('WikiStore: Updating page content for:', pagePath);
        const updatedPages = [...state.pages];
        const currentPage = updatedPages[existingIndex];

        // 只更新内容、最后修改时间和版本号，保留其他字段不变
        updatedPages[existingIndex] = {
          ...currentPage,
          wiki_content: content,
          last_modified: lastModified || (Date.now() / 1000),
          version: version || currentPage.version
        };

        // 如果当前选中的页面就是被更新的页面，同时更新selectedPage
        const updatedSelectedPage = state.selectedPage?.page_path === pagePath
          ? updatedPages[existingIndex]
          : state.selectedPage;

        return {
          ...state,
          pages: updatedPages,
          selectedPage: updatedSelectedPage
        };
      } else {
        // 页面不存在，记录警告但不执行操作
        console.warn('WikiStore: Cannot update content for non-existent page:', pagePath);
        return state;
      }
    });
  },

  setupEventListeners: () => {
    const { connection } = get();
    if (!connection) return;

    console.log('WikiStore: Setting up wiki event listeners');

    // 监听wiki相关事件
    connection.on('rawEvent', (event: any) => {
      // 处理页面创建事件
      if (event.event_name === 'wiki.page.created' && event.payload?.page) {
        console.log('WikiStore: Received wiki.page.created event:', event);
        const page = event.payload.page;

        // 将后端数据转换为WikiPage格式，统一时间戳处理
        const createdAt = normalizeTimestamp(page.created_at);
        const lastModified = normalizeTimestamp(page.last_modified || page.created_at);

        console.log('WikiStore: Normalized wiki.page.created timestamps - created_at:', createdAt, 'last_modified:', lastModified);

        const wikiPage: WikiPage = {
          page_path: page.page_path,
          title: page.title,
          wiki_content: page.wiki_content || '',
          creator_id: page.creator_id,
          created_at: createdAt,
          last_modified: lastModified,
          version: page.version || 1
        };

        get().updateOrAddPageToList(wikiPage);
      }

      // 处理wiki proposal通知事件
      else if (event.event_name === 'wiki.proposal.notification') {
        console.log('WikiStore: Received wiki.proposal.notification event:', event);
        console.log('WikiStore: Proposal notification payload:', JSON.stringify(event.payload, null, 2));

        // 重新加载proposals列表以获取最新的待审批提案
        get().loadProposals();
      }

      // 处理wiki通知事件
      else if (event.event_name === 'wiki.page.notification') {
        console.log('WikiStore: Received wiki.page.notification event:', event);
        console.log('WikiStore: Event payload:', JSON.stringify(event.payload, null, 2));

        // 检查各种可能的事件结构
        let pageData = null;

        // 方式1: payload直接包含页面数据
        if (event.payload?.page) {
          pageData = event.payload.page;
          console.log('WikiStore: Found page data in payload.page');
        }
        // 方式2: payload就是页面数据
        else if (event.payload?.page_path && event.payload?.title) {
          pageData = event.payload;
          console.log('WikiStore: Found page data directly in payload');
        }
        // 方式3: data字段包含页面数据
        else if (event.data?.page) {
          pageData = event.data.page;
          console.log('WikiStore: Found page data in data.page');
        }
        // 方式4: data就是页面数据
        else if (event.data?.page_path && event.data?.title) {
          pageData = event.data;
          console.log('WikiStore: Found page data directly in data');
        }

        if (pageData) {
          console.log('WikiStore: Processing page data:', pageData);

          // 检查是否是编辑事件
          if (pageData.action === 'page_edited') {
            // 对于编辑事件，只更新内容相关字段
            console.log('WikiStore: Handling page edit notification for:', pageData.page_path);

            const lastModified = normalizeTimestamp(
              pageData.edit_timestamp || pageData.last_modified || pageData.created_timestamp || pageData.created_at || pageData.timestamp
            );

            get().updatePageContent(
              pageData.page_path,
              pageData.wiki_content || pageData.content || '',
              lastModified,
              pageData.version
            );
          } else {
            // 对于其他事件（如创建），使用完整对象更新
            console.log('WikiStore: Handling non-edit page notification for:', pageData.page_path);

            const createdAt = normalizeTimestamp(
              pageData.created_timestamp || pageData.created_at || pageData.timestamp
            );
            const lastModified = normalizeTimestamp(
              pageData.last_modified || pageData.created_timestamp || pageData.created_at || pageData.timestamp
            );

            console.log('WikiStore: Normalized timestamps - created_at:', createdAt, 'last_modified:', lastModified);

            const wikiPage: WikiPage = {
              page_path: pageData.page_path,
              title: pageData.title,
              wiki_content: pageData.wiki_content || pageData.content || '(Content not available in notification)',
              creator_id: pageData.created_by || pageData.creator_id || pageData.owner_id || pageData.edited_by || 'unknown',
              created_at: createdAt,
              last_modified: lastModified,
              version: pageData.version || 1
            };

            console.log('WikiStore: Adding/updating wiki page from notification:', wikiPage);
            get().updateOrAddPageToList(wikiPage);
          }
        } else {
          console.log('WikiStore: No page data found in notification event, available keys:', Object.keys(event.payload || {}));
        }
      }
    });
  },

  cleanupEventListeners: () => {
    const { connection } = get();
    if (!connection) return;

    console.log('WikiStore: Cleaning up wiki event listeners');
    // 由于使用rawEvent，事件清理在组件层面管理
  },
}));