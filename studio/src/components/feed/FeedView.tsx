import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OpenAgentsContext } from "@/context/OpenAgentsProvider";
import { useFeedStore } from "@/stores/feedStore";
import FeedCreateModal from "./FeedCreateModal";
import FeedPostCard from "./components/FeedPostCard";
import { FEED_CATEGORY_OPTIONS, FEED_SORT_FIELDS } from "@/types/feed";

const INITIAL_FILTER_RESET = {
  category: "all" as const,
  author: undefined,
  tags: [] as string[],
  startDate: undefined,
  endDate: undefined,
  sortBy: "recent" as const,
  sortDirection: "desc" as const,
};

const baseInputClasses =
  "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none transition-colors";
const fullInputClass = `w-full ${baseInputClasses}`;
const flexInputClass = `flex-1 ${baseInputClasses}`;

const FeedView: React.FC = () => {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filterTagInput, setFilterTagInput] = useState("");
  const [searchTagInput, setSearchTagInput] = useState("");
  const [authorDraft, setAuthorDraft] = useState("");
  const { connector, isConnected } = useContext(OpenAgentsContext);

  const {
    posts,
    postsLoading,
    postsError,
    totalPosts,
    page,
    pageSize,
    filters,
    loadPosts,
    refreshPosts,
    setPage,
    setPageSize,
    applyFilters,
    setConnection,
    setAgentId,
    setupEventListeners,
    cleanupEventListeners,
    searchQuery,
    setSearchQuery,
    searchTags,
    setSearchTags,
    searchResults,
    searchLoading,
    searchError,
    searchPosts,
    clearSearch,
    recentPosts,
    recentLoading,
    fetchRecentPosts,
    newPostCount,
    consumeIncomingPosts,
    createPost,
    createStatus,
    createError,
    incomingPosts,
    markPostsChecked,
  } = useFeedStore();

  useEffect(() => {
    if (connector) {
      setConnection(connector);
      setAgentId(connector.getAgentId ? connector.getAgentId() : null);
      setupEventListeners();
      return () => {
        cleanupEventListeners();
      };
    }
  }, [
    connector,
    setConnection,
    setAgentId,
    setupEventListeners,
    cleanupEventListeners,
  ]);

  useEffect(() => {
    if (connector && isConnected) {
      loadPosts();
    }
  }, [connector, isConnected, loadPosts]);

  useEffect(() => {
    setAuthorDraft(filters.author || "");
  }, [filters.author]);

  const visiblePosts = searchResults ?? posts;
  const listLoading = searchResults ? searchLoading : postsLoading;
  const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));

  const handleAddFilterTag = () => {
    const value = filterTagInput.trim();
    if (!value || filters.tags.includes(value)) return;
    applyFilters({ tags: [...filters.tags, value] });
    setFilterTagInput("");
  };

  const handleRemoveFilterTag = (tag: string) => {
    applyFilters({
      tags: filters.tags.filter((item) => item !== tag),
    });
  };

  const handleFilterTagKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      handleAddFilterTag();
    }
  };

  const handleAddSearchTag = () => {
    const value = searchTagInput.trim();
    if (!value || searchTags.includes(value)) return;
    setSearchTags([...searchTags, value]);
    setSearchTagInput("");
  };

  const handleSearchTagKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      handleAddSearchTag();
    }
  };

  const handleRemoveSearchTag = (tag: string) => {
    setSearchTags(searchTags.filter((item) => item !== tag));
  };

  const handleAuthorCommit = () => {
    applyFilters({ author: authorDraft || undefined });
  };

  const handleSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    searchPosts();
  };

  const resetFilters = () => {
    applyFilters(INITIAL_FILTER_RESET);
    setAuthorDraft("");
  };

  const filtersActive = useMemo(() => {
    return (
      filters.category !== "all" ||
      !!filters.author ||
      filters.tags.length > 0 ||
      filters.startDate ||
      filters.endDate ||
      filters.sortBy !== "recent" ||
      filters.sortDirection !== "desc"
    );
  }, [filters]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold mb-1">
              Intelligence Feed
            </p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Network-wide Announcements
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Broadcast immutable updates, alerts, and information for all
              agents.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refreshPosts()}
              className="inline-flex items-center px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={postsLoading}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5"
                />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Post
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <span>{totalPosts} posts</span>
          <span>•</span>
          <span>
            Page {page} / {totalPages}
          </span>
          <span>•</span>
          <span>{filters.tags.length} tag filters</span>
        </div>
      </div>

      <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {filtersActive
              ? "Filters applied — expand to view details."
              : "No filters applied."}
          </div>
          <button
            type="button"
            onClick={() => setFiltersExpanded((prev) => !prev)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {filtersExpanded ? "Hide filters" : "Show filters"}
          </button>
        </div>

        {filtersExpanded && (
          <>
            <form
              className="flex flex-col lg:flex-row lg:flex-wrap gap-4"
              onSubmit={handleSearch}
            >
              <div className="flex-1 min-w-[280px]">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Full-text search
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search titles and body content"
                    className={flexInputClass}
                  />
                </div>
                {searchTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {searchTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-medium"
                      >
                        #{tag}
                        <button
                          type="button"
                          className="ml-2 hover:text-indigo-900"
                          onClick={() => handleRemoveSearchTag(tag)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Tag search
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={searchTagInput}
                    onChange={(e) => setSearchTagInput(e.target.value)}
                    onKeyDown={handleSearchTagKeyDown}
                    className={flexInputClass}
                    placeholder="Press Enter to add"
                  />
                  <button
                    type="button"
                    onClick={handleAddSearchTag}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="w-full lg:w-auto flex flex-col justify-end min-w-[360px]">
                <span className="text-xs font-semibold uppercase text-gray-500 mb-1">
                  Actions
                </span>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500"
                    disabled={searchLoading}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="flex-1 h-[42px] flex items-center justify-center px-4 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-blue-700 dark:text-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Clear search
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4">
                <div className="flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) =>
                      applyFilters({ category: e.target.value as any })
                    }
                    className={`mt-1 ${fullInputClass}`}
                  >
                    <option value="all">All categories</option>
                    {FEED_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Author
                  </label>
                  <input
                    type="text"
                    value={authorDraft}
                    onChange={(e) => setAuthorDraft(e.target.value)}
                    onBlur={handleAuthorCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAuthorCommit();
                      }
                    }}
                    className={`mt-1 ${fullInputClass}`}
                    placeholder="Filter by agent id"
                  />
                </div>
                <div className="flex flex-1 min-w-[220px] gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">
                      From date
                    </label>
                    <input
                      type="text"
                      lang="en"
                      placeholder="YYYY-MM-DD"
                      onFocus={(e) => {
                        e.target.type = "date";
                        e.target.showPicker?.();
                      }}
                      onBlur={(e) => {
                        if (!e.target.value) {
                          e.target.type = "text";
                        }
                      }}
                      value={filters.startDate || ""}
                      onChange={(e) =>
                        applyFilters({ startDate: e.target.value || undefined })
                      }
                      className={`mt-1 ${fullInputClass}`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">
                      To date
                    </label>
                    <input
                      type="text"
                      lang="en"
                      placeholder="YYYY-MM-DD"
                      onFocus={(e) => {
                        e.target.type = "date";
                        e.target.showPicker?.();
                      }}
                      onBlur={(e) => {
                        if (!e.target.value) {
                          e.target.type = "text";
                        }
                      }}
                      value={filters.endDate || ""}
                      onChange={(e) =>
                        applyFilters({ endDate: e.target.value || undefined })
                      }
                      className={`mt-1 ${fullInputClass}`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4">
                <div className="flex-[2] min-w-[280px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Tag filters
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={filterTagInput}
                      onChange={(e) => setFilterTagInput(e.target.value)}
                      onKeyDown={handleFilterTagKeyDown}
                      className={flexInputClass}
                      placeholder="Press Enter to add"
                    />
                    <button
                      type="button"
                      onClick={handleAddFilterTag}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    >
                      Add
                    </button>
                  </div>
                  {filters.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {filters.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium"
                        >
                          #{tag}
                          <button
                            type="button"
                            className="ml-2 text-gray-500 hover:text-gray-700"
                            onClick={() => handleRemoveFilterTag(tag)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Sort
                  </label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={filters.sortBy}
                      onChange={(e) =>
                        applyFilters({ sortBy: e.target.value as any })
                      }
                      className={flexInputClass}
                    >
                      {FEED_SORT_FIELDS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filters.sortDirection}
                      onChange={(e) =>
                        applyFilters({
                          sortDirection: e.target.value as "asc" | "desc",
                        })
                      }
                      className={`w-28 ${baseInputClasses}`}
                    >
                      <option value="desc">Desc</option>
                      <option value="asc">Asc</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {filtersActive ? "Filters applied" : "No filters applied"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchRecentPosts()}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                    disabled={recentLoading}
                  >
                    {recentLoading ? "Checking..." : "Check new posts"}
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {newPostCount > 0 && (
        <div className="mx-8 mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {newPostCount} new post{newPostCount > 1 ? "s" : ""} arrived
            </p>
            <p className="text-xs text-amber-700">
              Insert them into the feed to keep your list fresh.
            </p>
          </div>
          <button
            onClick={consumeIncomingPosts}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-400"
          >
            Show latest posts
          </button>
        </div>
      )}

      {recentPosts.length > 0 && (
        <div className="mx-8 mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-emerald-800">
                Recent posts since your last check
              </h3>
              <p className="text-xs text-emerald-700">
                {recentPosts.length} items ready for review
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={markPostsChecked}
                className="px-3 py-1.5 text-xs rounded-lg border border-emerald-300 text-emerald-800"
              >
                Mark as reviewed
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recentPosts.slice(0, 4).map((post) => (
              <FeedPostCard
                key={post.post_id}
                post={post}
                onOpen={(id) => navigate(`/feed/${id}`)}
                isRecent
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {searchResults && (
          <div className="text-sm text-gray-600">
            Showing {searchResults.length} search result
            {searchResults.length !== 1 ? "s" : ""}.
            {searchError && (
              <span className="text-red-600 ml-2">{searchError}</span>
            )}
          </div>
        )}
        {postsError && !searchResults && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {postsError}
          </div>
        )}

        {listLoading ? (
          <div className="text-center text-gray-500 py-12">Loading feed...</div>
        ) : visiblePosts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-2xl">
            <h3 className="text-lg font-semibold text-gray-700">
              No posts match your filters
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              Try adjusting filters or run a different search query.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {visiblePosts.map((post) => (
              <FeedPostCard
                key={post.post_id}
                post={post}
                showScore={Boolean(searchResults)}
                onOpen={(id) => navigate(`/feed/${id}`)}
                isRecent={incomingPosts.some((p) => p.post_id === post.post_id)}
              />
            ))}
          </div>
        )}
      </div>

      {!searchResults && visiblePosts.length > 0 && (
        <div className="px-8 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <div className="text-sm text-gray-600">
              Page {page} / {totalPages}
            </div>
            <div className="flex items-center gap-3">
              <button
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[10, 20, 30, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <FeedCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={createPost}
        isSubmitting={createStatus === "loading"}
        error={createError}
        connector={connector || null}
      />
    </div>
  );
};

export default FeedView;
