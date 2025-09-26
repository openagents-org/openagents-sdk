import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForumStore } from '@/stores/forumStore';
import { useOpenAgentsService } from '@/contexts/OpenAgentsServiceContext';
import useConnectedStatus from '@/hooks/useConnectedStatus';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import ForumCommentThread from './components/ForumCommentThread';
import { useToast } from '@/context/ToastContext';

interface ForumTopicDetailProps {}

const ForumTopicDetail: React.FC<ForumTopicDetailProps> = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();

  const [newCommentContent, setNewCommentContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { service: openAgentsService } = useOpenAgentsService();
  const { isConnected } = useConnectedStatus();
  const { error: showErrorToast } = useToast();

  const {
    selectedTopic,
    comments,
    commentsLoading,
    commentsError,
    setConnection,
    loadTopicDetail,
    addComment,
    vote,
    resetSelectedTopic,
    getTotalComments
  } = useForumStore();

  // 使用实时计算的评论总数
  const totalComments = getTotalComments();


  // 设置连接
  useEffect(() => {
    if (openAgentsService) {
      console.log('ForumTopicDetail: Setting connection');
      setConnection(openAgentsService);
    }
  }, [openAgentsService, setConnection]);

  // 加载话题详情（等待连接建立）
  useEffect(() => {
    if (topicId && openAgentsService && isConnected) {
      console.log('ForumTopicDetail: Connection ready, loading topic detail for:', topicId);
      loadTopicDetail(topicId);
    } else {
      console.log('ForumTopicDetail: Waiting for connection or missing topicId', {
        topicId,
        hasService: !!openAgentsService,
        isConnected
      });
    }
  }, [topicId, openAgentsService, isConnected, loadTopicDetail]);

  // 组件卸载时重置选中话题
  useEffect(() => {
    return () => {
      console.log('ForumTopicDetail: Cleanup - resetting selected topic');
      resetSelectedTopic();
    };
  }, [resetSelectedTopic]);

  const handleBack = () => {
    navigate('/forum');
  };

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (selectedTopic) {
      await vote('topic', selectedTopic.topic_id, voteType, showErrorToast);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentContent.trim() || !topicId) return;

    setIsSubmitting(true);
    const success = await addComment(topicId, newCommentContent.trim());

    if (success) {
      setNewCommentContent('');
      setShowPreview(false);
    }
    setIsSubmitting(false);
  };

  // 显示连接等待状态
  if (!openAgentsService || !isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {!openAgentsService ? 'Connecting to network...' : 'Establishing connection...'}
          </p>
        </div>
      </div>
    );
  }

  // 显示加载状态
  if (commentsLoading && !selectedTopic) {
    return (
      <div className="flex-1 flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading topic...
          </p>
        </div>
      </div>
    );
  }

  // 显示错误状态
  if (commentsError || !selectedTopic) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className={`text-red-500 mb-4`}>
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            {commentsError || 'Topic not found'}
          </p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Forum List
          </button>
        </div>
      </div>
    );
  }

  const timeAgo = new Date(selectedTopic.timestamp * 1000).toLocaleString();

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 头部导航 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={handleBack}
          className="flex items-center space-x-2 text-sm transition-colors text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Forum List</span>
        </button>
      </div>

      {/* 主要内容 - 使用全宽度 */}
      <div className="flex-1 flex flex-col overflow-hidden dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* 话题内容 */}
        <div className="p-6 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          {/* 话题标题 */}
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            {selectedTopic.title}
          </h1>

          {/* 话题元信息 */}
          <div className="flex items-center justify-between mb-4 text-sm text-gray-600 dark:text-gray-400">
            <span>
              by {selectedTopic.owner_id} • {timeAgo}
            </span>
            <span>
              {totalComments} comments
            </span>
          </div>

          {/* 话题内容 */}
          <div className="mb-4">
            <MarkdownRenderer
              content={selectedTopic.content}
            />
          </div>

          {/* 投票和统计 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleVote('upvote')}
                className="flex items-center space-x-1 p-2 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
              >
                <span className="text-lg">👍</span>
                <span className="text-sm font-medium">
                  {selectedTopic.upvotes}
                </span>
              </button>
              <button
                onClick={() => handleVote('downvote')}
                className="flex items-center space-x-1 p-2 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              >
                <span className="text-lg">👎</span>
                <span className="text-sm font-medium">
                  {selectedTopic.downvotes}
                </span>
              </button>
            </div>
          </div>
        </div>

            {/* 评论标题 */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Comments ({totalComments})
              </h2>
            </div>

            {/* 评论列表 - 可滚动的中间区域 */}
            <div className="py-4">
              {commentsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Loading comments...
                  </p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    No comments yet. Be the first to comment!
                  </p>
                </div>
              ) : (
                <ForumCommentThread
                  comments={comments}
                  topicId={selectedTopic.topic_id}
                />
              )}
            </div>
          </div>

          {/* 添加评论表单 - 固定在底部 */}
          <div className="px-6 py-4 border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Add a comment (Markdown supported)
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  showPreview
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>

            {showPreview ? (
              <div className="w-full p-3 border rounded-md min-h-[120px] mb-3 bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                {newCommentContent.trim() ? (
                  <MarkdownRenderer
                    content={newCommentContent}
                  />
                ) : (
                  <p className="text-gray-400 dark:text-gray-500">
                    Preview will appear here...
                  </p>
                )}
              </div>
            ) : (
              <textarea
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                placeholder="Write your comment..."
                rows={4}
                className="w-full p-3 border rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            )}

            <div className="flex justify-end">
              <button
                onClick={handleAddComment}
                disabled={!newCommentContent.trim() || isSubmitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  !newCommentContent.trim() || isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};

export default ForumTopicDetail;