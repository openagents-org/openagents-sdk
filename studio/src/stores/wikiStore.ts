import { create } from 'zustand';
import { OpenAgentsService } from '../services/openAgentsService';

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
    const { connection, loadPages } = get();
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
        loadPages();
        return true;
      } else {
        set({ pagesError: response.message || 'Failed to create wiki page' });
        return false;
      }
    } catch (err) {
      console.error('Failed to create wiki page:', err);
      set({ pagesError: 'Failed to create wiki page' });
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

  setupEventListeners: () => {
    const { connection } = get();
    if (!connection) return;

    console.log('WikiStore: Setting up event listeners...');
  },

  cleanupEventListeners: () => {
    console.log('WikiStore: Cleaning up event listeners...');
  },
}));