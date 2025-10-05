import { create } from "zustand";
import { eventRouter } from "@/services/eventRouter";
// import { HttpEventConnector } from "@/services/openAgentsService";

// Types
export interface ForumTopic {
  topic_id: string;
  title: string;
  content: string;
  owner_id: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  allowed_groups?: string[];
}

export interface ForumComment {
  comment_id: string;
  topic_id: string;
  content: string;
  author_id: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
  parent_comment_id?: string;
  thread_level: number;
  replies?: ForumComment[];
}

export interface CreateTopicData {
  title: string;
  content: string;
  allowed_groups?: string[];
}

// 递归更新评论 votes 的辅助函数
const updateCommentVotesRecursively = (
  comments: ForumComment[],
  targetId: string,
  upvotes: number,
  downvotes: number
): ForumComment[] => {
  return comments.map((comment) => {
    if (comment.comment_id === targetId) {
      // 找到目标评论，更新 votes
      console.log(
        `ForumStore: Updating votes for comment ${targetId}: upvotes=${upvotes}, downvotes=${downvotes}`
      );
      return { ...comment, upvotes, downvotes };
    } else if (comment.replies && comment.replies.length > 0) {
      // 递归更新 replies 中的评论
      const updatedReplies = updateCommentVotesRecursively(
        comment.replies,
        targetId,
        upvotes,
        downvotes
      );
      // 只有当 replies 发生变化时才返回新对象
      if (updatedReplies !== comment.replies) {
        return { ...comment, replies: updatedReplies };
      }
    }
    return comment;
  });
};

interface ForumState {
  // 话题列表
  topics: ForumTopic[];
  topicsLoading: boolean;
  topicsError: string | null;

  // 当前话题详情
  selectedTopic: ForumTopic | null;
  comments: ForumComment[];
  commentsLoading: boolean;
  commentsError: string | null;

  // 连接服务
  connection: any | null;

  // Permission groups
  groupsData: Record<string, string[]> | null;
  agentId: string | null;

  // Event handler reference for cleanup
  eventHandler?: ((event: any) => void) | null;

  // Actions
  setConnection: (connection: any | null) => void;
  setGroupsData: (groups: Record<string, string[]>) => void;
  setAgentId: (agentId: string) => void;
  loadTopics: () => Promise<void>;
  loadTopicDetail: (topicId: string) => Promise<void>;
  createTopic: (data: CreateTopicData) => Promise<boolean>;
  addComment: (
    topicId: string,
    content: string,
    parentId?: string
  ) => Promise<boolean>;
  vote: (
    type: "topic" | "comment",
    targetId: string,
    voteType: "upvote" | "downvote",
    onError?: (message: string) => void
  ) => Promise<boolean>;

  // Real-time updates
  addTopicToList: (topic: ForumTopic) => void;
  addCommentToTopic: (topicId: string, comment: ForumComment) => void;
  countAllComments: (comments: ForumComment[]) => number;
  refreshTopicInList: (topicId: string) => Promise<void>;

  // Computed
  getPopularTopics: () => ForumTopic[];
  getTotalComments: () => number;

  // Reset
  resetSelectedTopic: () => void;

  // Event handling
  setupEventListeners: () => void;
  cleanupEventListeners: () => void;
}

export const useForumStore = create<ForumState>((set, get) => ({
  // Initial state
  topics: [],
  topicsLoading: false,
  topicsError: null,
  selectedTopic: null,
  comments: [],
  commentsLoading: false,
  commentsError: null,
  connection: null,
  groupsData: null,
  agentId: null,
  eventHandler: null,

  // Actions
  setConnection: (connection) => set({ connection }),
  setGroupsData: (groups) => set({ groupsData: groups }),
  setAgentId: (agentId) => set({ agentId }),

  loadTopics: async () => {
    const { connection } = get();
    if (!connection) {
      console.warn("ForumStore: No connection available for loadTopics");
      set({ topicsError: "No connection available" });
      return;
    }

    console.log("ForumStore: Loading topics...");
    set({ topicsLoading: true, topicsError: null });

    try {
      const response = await connection.sendEvent({
        event_name: "forum.topics.list",
        destination_id: "mod:openagents.mods.workspace.forum",
        payload: {
          query_type: "list_topics",
          limit: 50,
          offset: 0,
          sort_by: "recent",
        },
      });

      if (response.success && response.data) {
        console.log(
          "ForumStore: API success, loaded topics:",
          response.data.topics?.length || 0
        );
        set({
          topics: response.data.topics || [],
          topicsLoading: false,
        });
      } else {
        // API失败时设置错误状态
        console.warn(
          "ForumStore: API failed to load topics. Response:",
          response
        );
        set({
          topics: [],
          topicsLoading: false,
          topicsError: "Failed to load topics",
        });
      }
    } catch (error) {
      console.error("ForumStore: Failed to load topics:", error);
      set({
        topicsError: "Failed to load topics",
        topicsLoading: false,
      });
    }
  },

  loadTopicDetail: async (topicId: string) => {
    const { connection, topics } = get();

    console.log("ForumStore: Loading topic detail for ID:", topicId);
    console.log(
      "ForumStore: Available topics:",
      topics.map((t) => ({ id: t.topic_id, title: t.title }))
    );

    set({ commentsLoading: true, commentsError: null });

    // 首先尝试从已加载的topics中查找 - 这样可以立即显示详情
    const existingTopic = topics.find((t) => t.topic_id === topicId);

    if (existingTopic) {
      console.log(
        "ForumStore: Found existing topic in memory:",
        existingTopic.title
      );
      // 立即显示话题，评论为空数组
      set({
        selectedTopic: existingTopic,
        comments: [],
        commentsLoading: false,
      });

      // 可选：在后台尝试从API获取最新的评论数据
      if (connection) {
        try {
          const response = await connection.sendEvent({
            event_name: "forum.topic.get",
            destination_id: "mod:openagents.mods.workspace.forum",
            payload: {
              query_type: "get_topic",
              topic_id: topicId,
            },
          });

          if (response.success && response.data && response.data.comments) {
            console.log("ForumStore: Updated comments from API");
            // 按timestamp降序排序，确保最新comment在最上面
            const sortedComments = [...response.data.comments].sort(
              (a, b) => b.timestamp - a.timestamp
            );

            // 同步更新topics列表中的comment_count
            const updatedTopics = get().topics.map((t) =>
              t.topic_id === topicId
                ? { ...t, comment_count: sortedComments.length }
                : t
            );

            set({
              comments: sortedComments,
              topics: updatedTopics,
            });
          }
        } catch (error) {
          console.warn(
            "ForumStore: Failed to update comments from API:",
            error
          );
        }
      }

      return;
    }

    // 如果在topics中找不到，且没有连接，显示错误
    if (!connection) {
      console.warn(
        "ForumStore: No connection available and topic not found in memory"
      );
      set({
        commentsError: "Topic not found and no network connection",
        commentsLoading: false,
      });
      return;
    }

    // 尝试从API加载topic详情
    try {
      const response = await connection.sendEvent({
        event_name: "forum.topic.get",
        destination_id: "mod:openagents.mods.workspace.forum",
        payload: {
          query_type: "get_topic",
          topic_id: topicId,
        },
      });

      if (response.success && response.data) {
        console.log("ForumStore: API success, topic data:", response.data);

        // 检查数据结构 - API可能返回 response.data 就是topic，或者 response.data.topic
        const topic = response.data.topic_id
          ? response.data
          : response.data.topic;

        if (topic) {
          // 按timestamp降序排序comments，确保最新comment在最上面
          const comments = response.data.comments || [];
          const sortedComments = [...comments].sort(
            (a, b) => b.timestamp - a.timestamp
          );

          // 同步更新topics列表中对应topic的comment_count
          const updatedTopics = get().topics.map((t) =>
            t.topic_id === topicId
              ? {
                  ...t,
                  comment_count: topic.comment_count || sortedComments.length,
                }
              : t
          );

          set({
            selectedTopic: topic,
            comments: sortedComments,
            topics: updatedTopics,
            commentsLoading: false,
          });
          return;
        }
      }

      // API调用失败，显示错误状态
      console.warn(
        "ForumStore: API failed to load topic details. Response:",
        response
      );
      set({
        selectedTopic: null,
        comments: [],
        commentsError: "Failed to load topic details",
        commentsLoading: false,
      });
    } catch (error) {
      console.error("ForumStore: Failed to load topic details:", error);
      set({
        commentsError: "Failed to load topic details",
        commentsLoading: false,
      });
    }
  },

  createTopic: async (data: CreateTopicData) => {
    const { connection } = get();
    if (!connection) return false;

    try {
      const allowed_groups =
        data.allowed_groups && data.allowed_groups.length > 0
          ? data.allowed_groups
          : undefined;
      const response = await connection.sendEvent({
        event_name: "forum.topic.create",
        destination_id: "mod:openagents.mods.workspace.forum",
        payload: {
          action: "create",
          title: data.title.trim(),
          content: data.content.trim(),
          allowed_groups,
        },
      });

      if (response.success) {
        // 构造新话题对象并直接添加到列表
        const newTopic: ForumTopic = {
          topic_id:
            response.data?.topic_id ||
            `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          title: data.title.trim(),
          content: data.content.trim(),
          owner_id: connection.getAgentId() || "unknown",
          timestamp: response.data?.timestamp || Date.now() / 1000,
          upvotes: 0,
          allowed_groups,
          downvotes: 0,
          comment_count: 0,
        };

        console.log("ForumStore: Creating topic with data:", newTopic);

        // 直接添加到列表顶部，无需重新加载
        get().addTopicToList(newTopic);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to create topic:", error);
      return false;
    }
  },

  addComment: async (topicId: string, content: string, parentId?: string) => {
    const { connection } = get();
    if (!connection) return false;

    try {
      const response = await connection.sendEvent({
        event_name: parentId ? "forum.comment.reply" : "forum.comment.post",
        destination_id: "mod:openagents.mods.workspace.forum",
        payload: {
          action: parentId ? "reply" : "post",
          topic_id: topicId,
          content: content.trim(),
          ...(parentId && { parent_comment_id: parentId }),
        },
      });

      if (response.success && response.data?.comment) {
        console.log(
          "ForumStore: Comment posted successfully, using incremental update"
        );

        // 使用返回的comment数据进行增量更新
        const comment = response.data.comment;
        const forumComment: ForumComment = {
          comment_id: comment.comment_id,
          topic_id: comment.topic_id,
          content: comment.content,
          author_id: comment.author_id,
          timestamp: comment.timestamp,
          upvotes: comment.upvotes || 0,
          downvotes: comment.downvotes || 0,
          parent_comment_id: comment.parent_comment_id,
          thread_level: comment.thread_level || (parentId ? 1 : 0),
          replies: [],
        };

        get().addCommentToTopic(topicId, forumComment);
        return true;
      } else if (response.success) {
        // 如果没有返回comment数据，则使用原来的方式刷新
        console.log(
          "ForumStore: Comment posted but no comment data returned, falling back to reload"
        );
        await get().loadTopicDetail(topicId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to add comment:", error);
      return false;
    }
  },

  vote: async (
    type: "topic" | "comment",
    targetId: string,
    voteType: "upvote" | "downvote",
    onError?: (message: string) => void
  ) => {
    const { connection } = get();
    if (!connection) {
      onError?.("No connection available");
      return false;
    }

    try {
      const response = await connection.sendEvent({
        event_name: "forum.vote.cast",
        destination_id: "mod:openagents.mods.workspace.forum",
        payload: {
          action: "cast",
          target_type: type,
          target_id: targetId,
          vote_type: voteType,
        },
      });

      if (response.success) {
        // 刷新数据
        if (type === "topic") {
          await get().loadTopics();
          // 如果是当前选中的topic，也刷新详情
          const { selectedTopic } = get();
          if (selectedTopic && selectedTopic.topic_id === targetId) {
            await get().loadTopicDetail(targetId);
          }
        } else {
          // 刷新评论
          const { selectedTopic } = get();
          if (selectedTopic) {
            await get().loadTopicDetail(selectedTopic.topic_id);
          }
        }
        return true;
      } else {
        // 处理投票失败的情况
        const errorMessage = response.message || "Vote failed";
        onError?.(errorMessage);
        return false;
      }
    } catch (error) {
      console.error("Failed to vote:", error);
      onError?.("Failed to vote due to network error");
      return false;
    }
  },

  getPopularTopics: () => {
    const { topics, groupsData, agentId } = get();
    console.log(
      "ForumStore: Getting popular topics:",
      topics,
      groupsData,
      agentId
    );

    // 如果 groupsData 还未加载，返回空数组
    if (!groupsData) {
      console.log(
        "ForumStore: groupsData not loaded yet, returning empty array"
      );
      return [];
    }

    // 过滤有权限查看的话题
    const filteredTopics = topics.filter((topic) => {
      // 如果没有 allowed_groups 或为空，说明是公开话题
      if (!topic.allowed_groups || topic.allowed_groups.length === 0) {
        return true;
      }

      // 检查当前 agent 是否在允许的组中
      if (agentId) {
        const hasPermission = topic.allowed_groups.some((groupName: string) => {
          const groupMembers = groupsData[groupName];
          return groupMembers && groupMembers.includes(agentId);
        });
        return hasPermission;
      }

      // 如果没有 agentId，不显示私有话题
      return false;
    });

    return [...filteredTopics]
      .sort((a, b) => b.upvotes + b.downvotes - (a.upvotes + a.downvotes))
      .slice(0, 10);
  },

  getTotalComments: () => {
    const { comments } = get();
    return get().countAllComments(comments);
  },

  resetSelectedTopic: () => {
    set({
      selectedTopic: null,
      comments: [],
      commentsError: null,
    });
  },

  // Real-time updates - 增量添加新topic到列表顶部
  addTopicToList: (newTopic: ForumTopic) => {
    set((state) => {
      // 检查topic是否已经存在，避免重复添加
      const exists = state.topics.some(
        (topic) => topic.topic_id === newTopic.topic_id
      );
      if (exists) {
        console.log(
          "ForumStore: Topic already exists in list, skipping:",
          newTopic.topic_id
        );
        return state;
      }

      console.log("ForumStore: Adding new topic to list:", newTopic.title);
      return {
        ...state,
        topics: [newTopic, ...state.topics],
      };
    });
  },

  // Event handling - 设置事件监听
  setupEventListeners: () => {
    const { connection } = get();
    if (!connection) return;

    console.log("ForumStore: Setting up forum event listeners");

    // 使用事件路由器监听forum相关事件
    const forumEventHandler = (event: any) => {
      console.log("ForumStore: Received forum event:", event);

      // 处理topic创建事件
      if (event.event_name === "forum.topic.created" && event.payload?.topic) {
        console.log("ForumStore: Received forum.topic.created event:", event);
        const topic = event.payload.topic;
        const allowed_groups = topic.allowed_groups;

        // 将后端数据转换为ForumTopic格式
        const forumTopic: ForumTopic = {
          topic_id: topic.topic_id,
          title: topic.title,
          content: topic.content || "",
          owner_id: topic.owner_id,
          timestamp: topic.timestamp,
          upvotes: topic.upvotes || 0,
          downvotes: topic.downvotes || 0,
          comment_count: topic.comment_count || 0,
          allowed_groups,
        };

        // 权限检查：判断当前agent是否有权限查看这个话题
        const { agentId, groupsData } = get();
        console.log(agentId, groupsData, "-----");

        // 如果没有allowed_groups或为空，说明是公开话题
        if (!allowed_groups || allowed_groups.length === 0) {
          console.log("ForumStore: Public topic, adding to list");
          get().addTopicToList(forumTopic);
          return;
        }

        // 检查当前agent是否在允许的组中
        if (agentId && groupsData) {
          // 检查agentId是否存在于allowed_groups中的任何一个组
          const hasPermission = allowed_groups.some((groupName: string) => {
            const groupMembers = groupsData[groupName];
            return groupMembers && groupMembers.includes(agentId);
          });

          if (hasPermission) {
            console.log(
              "ForumStore: Agent has permission, adding topic to list"
            );
            get().addTopicToList(forumTopic);
          } else {
            console.log(
              "ForumStore: Agent does not have permission, ignoring topic"
            );
          }
        } else {
          console.log(
            "ForumStore: Missing agentId or groupsData, cannot check permissions"
          );
        }
      }

      // 处理comment发布事件
      else if (
        event.event_name === "forum.comment.posted" &&
        event.payload?.comment
      ) {
        console.log("ForumStore: Received forum.comment.posted event:", event);
        const comment = event.payload.comment;
        const topicId = comment.topic_id;

        const { selectedTopic } = get();
        if (selectedTopic && selectedTopic.topic_id === topicId) {
          // 当前在详情页面 - 添加评论到详情页面
          const forumComment: ForumComment = {
            comment_id: comment.comment_id,
            topic_id: comment.topic_id,
            content: comment.content,
            author_id: comment.author_id,
            timestamp: comment.timestamp,
            upvotes: comment.upvotes || 0,
            downvotes: comment.downvotes || 0,
            parent_comment_id: comment.parent_comment_id,
            thread_level: comment.thread_level || 0,
            replies: [],
          };

          get().addCommentToTopic(topicId, forumComment);
          console.log(
            `ForumStore: Added comment to detail view for topic ${topicId}`
          );
        } else {
          // 当前在列表页面 - 重新获取主题信息以更新评论数量
          console.log(
            `ForumStore: Not viewing topic ${topicId}, refreshing topic in list`
          );
          get().refreshTopicInList(topicId);
        }
      }

      // 处理comment回复事件
      else if (
        event.event_name === "forum.comment.replied" &&
        event.payload?.comment
      ) {
        console.log("ForumStore: Received forum.comment.replied event:", event);
        const comment = event.payload.comment;
        const topicId = comment.topic_id;

        const { selectedTopic } = get();
        if (selectedTopic && selectedTopic.topic_id === topicId) {
          // 当前在详情页面 - 添加回复到详情页面
          const forumComment: ForumComment = {
            comment_id: comment.comment_id,
            topic_id: comment.topic_id,
            content: comment.content,
            author_id: comment.author_id,
            timestamp: comment.timestamp,
            upvotes: comment.upvotes || 0,
            downvotes: comment.downvotes || 0,
            parent_comment_id: comment.parent_comment_id,
            thread_level: comment.thread_level || 1,
            replies: [],
          };

          get().addCommentToTopic(topicId, forumComment);
          console.log(
            `ForumStore: Added reply to detail view for topic ${topicId}`
          );
        } else {
          // 当前在列表页面 - 重新获取主题信息以更新评论数量
          console.log(
            `ForumStore: Not viewing topic ${topicId}, refreshing topic in list`
          );
          get().refreshTopicInList(topicId);
        }
      }

      // 处理投票事件
      else if (event.event_name === "forum.vote.cast" && event.payload) {
        console.log("ForumStore: Received forum.vote.cast event:", event);
        const { target_type, target_id } = event.payload;

        // 根据投票目标类型刷新相应的数据
        if (target_type === "topic") {
          // 刷新topics列表以更新投票计数
          console.log("ForumStore: Vote cast on topic, refreshing topics list");
          get().loadTopics();

          // 如果是当前查看的topic，也刷新详情
          const { selectedTopic } = get();
          if (selectedTopic && selectedTopic.topic_id === target_id) {
            console.log(
              "ForumStore: Vote cast on current topic, refreshing topic detail"
            );
            get().loadTopicDetail(target_id);
          }
        } else if (target_type === "comment") {
          // 刷新当前topic的评论以更新投票计数
          const { selectedTopic } = get();
          if (selectedTopic) {
            console.log(
              "ForumStore: Vote cast on comment, refreshing topic detail"
            );
            get().loadTopicDetail(selectedTopic.topic_id);
          }
        }
      } else if (event.event_name === "forum.vote.notification") {
        console.log(
          "ForumStore: Received forum.vote.notification event:",
          event
        );
        const { target_type, target_id, upvotes, downvotes } = event.payload;

        if (target_type === "topic") {
          // Update topic in topics list
          set((state) => ({
            topics: state.topics.map((topic) =>
              topic.topic_id === target_id
                ? { ...topic, upvotes, downvotes }
                : topic
            ),
          }));

          // Update currently selected topic if it matches
          const { selectedTopic } = get();
          if (selectedTopic && selectedTopic.topic_id === target_id) {
            set((state) => ({
              ...state,
              selectedTopic: { ...selectedTopic, upvotes, downvotes },
            }));
          }
        } else if (target_type === "comment") {
          // Update comment in the current topic's comments (including nested replies)
          set((state) => ({
            comments: updateCommentVotesRecursively(
              state.comments,
              target_id,
              upvotes,
              downvotes
            ),
          }));
        }
      }
    };

    // 注册到事件路由器
    eventRouter.onForumEvent(forumEventHandler);

    // 保存handler引用以便清理
    set({ eventHandler: forumEventHandler });
  },

  // 递归计算所有评论数量（包括嵌套的回复）
  countAllComments: (comments: ForumComment[]): number => {
    let total = 0;
    for (const comment of comments) {
      total += 1; // 当前评论
      if (comment.replies && comment.replies.length > 0) {
        total += get().countAllComments(comment.replies); // 递归计算子评论
      }
    }
    return total;
  },

  // 重新获取并更新列表中的特定主题信息
  refreshTopicInList: async (topicId: string) => {
    const { connection } = get();
    if (!connection) {
      console.warn(
        "ForumStore: No connection available for refreshTopicInList"
      );
      return;
    }

    try {
      console.log(`ForumStore: Refreshing topic ${topicId} in list`);
      const response = await connection.sendEvent({
        event_name: "forum.topic.get",
        destination_id: "mod:openagents.mods.workspace.forum",
        payload: {
          query_type: "get_topic",
          topic_id: topicId,
        },
      });

      if (response.success && response.data) {
        // 检查数据结构 - API可能返回 response.data 就是topic，或者 response.data.topic
        const topic = response.data.topic_id
          ? response.data
          : response.data.topic;

        if (topic) {
          console.log(
            `ForumStore: Updating topic ${topicId} with fresh data:`,
            {
              comment_count: topic.comment_count,
              upvotes: topic.upvotes,
              downvotes: topic.downvotes,
            }
          );

          // 更新 topics 列表中的对应主题
          set((state) => ({
            topics: state.topics.map((t) =>
              t.topic_id === topicId
                ? {
                    ...t,
                    comment_count: topic.comment_count || 0,
                    upvotes: topic.upvotes || 0,
                    downvotes: topic.downvotes || 0,
                    // 保持其他字段不变，只更新需要的统计数据
                  }
                : t
            ),
          }));
        } else {
          console.warn(`ForumStore: No topic data in response for ${topicId}`);
        }
      } else {
        console.warn(
          `ForumStore: Failed to refresh topic ${topicId}:`,
          response
        );
      }
    } catch (error) {
      console.error(`ForumStore: Error refreshing topic ${topicId}:`, error);
    }
  },

  // 增量更新comment到当前topic
  addCommentToTopic: (_topicId: string, newComment: ForumComment) => {
    set((state) => {
      // 检查comment是否已存在，避免重复添加
      const exists = state.comments.some(
        (comment) => comment.comment_id === newComment.comment_id
      );
      if (exists) {
        console.log(
          "ForumStore: Comment already exists, skipping:",
          newComment.comment_id
        );
        return state;
      }

      // 递归查找父评论并添加回复
      const addReplyToParent = (
        comments: ForumComment[],
        parentId: string,
        reply: ForumComment
      ): boolean => {
        for (let i = 0; i < comments.length; i++) {
          const comment = comments[i];
          if (comment.comment_id === parentId) {
            // 找到父评论，将回复添加到其replies数组的开头（最新的在前）
            if (!comment.replies) {
              comment.replies = [];
            }
            comment.replies.unshift(reply);
            return true;
          }
          // 递归查找子评论
          if (comment.replies && comment.replies.length > 0) {
            if (addReplyToParent(comment.replies, parentId, reply)) {
              return true;
            }
          }
        }
        return false;
      };

      let updatedComments = [...state.comments];

      if (newComment.parent_comment_id) {
        // 这是一个回复，查找父评论并添加到其replies中
        const foundParent = addReplyToParent(
          updatedComments,
          newComment.parent_comment_id,
          newComment
        );
        if (!foundParent) {
          // 如果找不到父评论，将其作为一级评论处理
          console.warn(
            "ForumStore: Parent comment not found, treating as root comment:",
            newComment.parent_comment_id
          );
          updatedComments.unshift(newComment);
        }
      } else {
        // 这是一级评论，添加到根评论列表的开头（最新的在前）
        updatedComments.unshift(newComment);
      }

      console.log(
        "ForumStore: Added comment, parent_comment_id:",
        newComment.parent_comment_id
      );

      return {
        ...state,
        comments: updatedComments,
      };
    });
  },

  // 清理事件监听
  cleanupEventListeners: () => {
    const { eventHandler } = get();

    console.log("ForumStore: Cleaning up forum event listeners");

    if (eventHandler) {
      eventRouter.offForumEvent(eventHandler);
      set({ eventHandler: null });
    }
  },
}));

// 在开发环境中绑定测试工具到全局对象
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).useForumStore = useForumStore;
  console.log(
    "🧪 Forum store and test utils available globally for development testing"
  );
}
