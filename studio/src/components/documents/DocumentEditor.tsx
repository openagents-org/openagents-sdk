import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '@/stores/documentStore';
import { useThemeStore } from '@/stores/themeStore';
import CollaborativeEditor from './CollaborativeEditor';

const DocumentEditor: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { theme } = useThemeStore();

  const {
    documents,
    getDocumentContent,
    saveDocumentContent,
    initializeCollaboration,
    destroyCollaboration,
    isCollaborationEnabled
  } = useDocumentStore();

  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 查找当前文档
  useEffect(() => {
    if (!documentId) {
      setError('文档 ID 不存在');
      setIsLoading(false);
      return;
    }

    const foundDocument = documents.find(doc => doc.document_id === documentId);
    if (foundDocument) {
      setDocument(foundDocument);
      setIsLoading(false);
    } else {
      setError('文档不存在');
      setIsLoading(false);
    }
  }, [documentId, documents]);

  // 处理内容变更
  const handleContentChange = useCallback((content: string) => {
    // 自动保存逻辑可以在这里实现
    console.log('📝 Content changed:', content.length, 'characters');
  }, []);

  // 处理保存
  const handleSave = useCallback(async (content: string) => {
    if (!documentId || isSaving) return;

    try {
      setIsSaving(true);
      const success = await saveDocumentContent(documentId, content);

      if (success) {
        setLastSaved(new Date());
        console.log('✅ Document saved successfully');
      } else {
        console.error('❌ Failed to save document');
      }
    } catch (error) {
      console.error('❌ Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [documentId, saveDocumentContent, isSaving]);

  // 返回文档列表
  const handleBack = useCallback(() => {
    // 清理协作服务
    if (documentId) {
      destroyCollaboration(documentId);
    }
    navigate('/documents');
  }, [documentId, destroyCollaboration, navigate]);

  // 格式化最后保存时间
  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 10) return '刚刚保存';
    if (diffSecs < 60) return `${diffSecs} 秒前保存`;
    if (diffMins < 60) return `${diffMins} 分钟前保存`;

    return date.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className={`h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            正在加载文档...
          </p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className={`h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className={`text-lg font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
          }`}>
            文档加载失败
          </h3>
          <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
            {error}
          </p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回文档列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* 顶部标题栏 */}
      <div className={`flex items-center justify-between p-4 border-b ${
        theme === 'dark'
          ? 'border-gray-700 bg-gray-800'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <h1 className={`text-xl font-bold ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
            }`}>
              {document.name}
            </h1>
            <div className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {document.creator} 创建 · v{document.version}
              {lastSaved && (
                <span className="ml-2">
                  · {formatLastSaved(lastSaved)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isSaving && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">保存中...</span>
            </div>
          )}

          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {isCollaborationEnabled ? '协作模式' : '单机模式'}
          </div>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="flex-1 overflow-hidden">
        {isCollaborationEnabled ? (
          <CollaborativeEditor
            documentId={documentId!}
            initialContent={getDocumentContent(documentId!) || '// 开始编写你的代码...\n\nfunction example() {\n  console.log("Hello, collaborative editing!");\n}\n\nexample();'}
            onContentChange={handleContentChange}
            onSave={handleSave}
            language="typescript"
            height="100%"
          />
        ) : (
          <div className={`h-full flex items-center justify-center ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="text-center">
              <div className={`text-6xl mb-4 ${
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                📝
              </div>
              <h3 className={`text-lg font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}>
                协作功能已禁用
              </h3>
              <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                启用协作功能以开始编辑文档
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentEditor;