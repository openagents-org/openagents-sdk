import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import { CollaborationService, CollaborationUser, ConnectionStatus } from '@/services/collaborationService';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import ConnectionStatusIndicator from './ConnectionStatus';
import OnlineUsersList from './OnlineUsers';

// Use Monaco types through the useMonaco hook

interface CollaborativeEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  language?: string;
  height?: string | number;
  className?: string;
}

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  documentId,
  initialContent = '',
  onContentChange,
  onSave,
  readOnly = false,
  language = 'typescript',
  height = '100%',
  className = ''
}) => {
  const { theme } = useThemeStore();
  const { agentName } = useAuthStore();
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const collaborationRef = useRef<CollaborationService | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const userDecorationsRef = useRef<Map<string, string[]>>(new Map());
  const lastCursorPositionRef = useRef<{ line: number; column: number } | null>(null);

  // 状态
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [onlineUsers, setOnlineUsers] = useState<CollaborationUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 更新用户光标
  const updateUserCursor = useCallback((userId: string, user: CollaborationUser) => {
    if (!editorRef.current || !user.cursor || !monaco || !userDecorationsRef.current) return;

    const editor = editorRef.current;
    const { line, column } = user.cursor;

    // 清除旧的装饰
    const oldDecorations = userDecorationsRef.current.get(userId) || [];

    // 创建新的装饰
    const newDecorations = editor.deltaDecorations(
      oldDecorations,
      [
        {
          range: new monaco.Range(line, column, line, column),
          options: {
            className: 'user-cursor',
            stickiness: 1,
            hoverMessage: { value: `**${user.name}** is here` }
          }
        },
        {
          range: new monaco.Range(line, column, line, column),
          options: {
            className: 'user-cursor-line',
            isWholeLine: true,
            linesDecorationsClassName: 'user-cursor-line'
          }
        }
      ]
    );

    if (userDecorationsRef.current) {
      userDecorationsRef.current.set(userId, newDecorations);
    }
  }, [monaco]);

  // 初始化协作服务
  const initializeCollaboration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 清理之前的协作服务
      if (collaborationRef.current) {
        console.log('🧹 [CollaborativeEditor] Cleaning up previous collaboration service');
        collaborationRef.current.destroy();
        collaborationRef.current = null;
      }
      if (bindingRef.current) {
        console.log('🧹 [CollaborativeEditor] Cleaning up previous Monaco binding');
        bindingRef.current.destroy();
        bindingRef.current = null;
      }

      const roomName = `document-${documentId}`;
      const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      console.log('🚀 [CollaborativeEditor] Initializing collaboration...');
      console.log('   📄 Document ID:', documentId);
      console.log('   🏠 Room Name:', roomName);
      console.log('   👤 User ID:', userId);
      console.log('   👤 Agent Name:', agentName);
      console.log('   🔗 WebSocket URL: ws://localhost:1234');

      // 创建协作服务
      const collaborationService = new CollaborationService(
        roomName,
        userId,
        'ws://localhost:1234',
        agentName || undefined
      );

      collaborationRef.current = collaborationService;

      // 设置事件监听器
      collaborationService.onConnectionStatusChange((status) => {
        console.log('🔗 [CollaborativeEditor] Connection status changed:', status);
        setConnectionStatus(status);
        if (status === ConnectionStatus.CONNECTED) {
          console.log('✅ [CollaborativeEditor] Successfully connected to collaboration server');
          setError(null);
          setIsLoading(false);
        }
      });

      collaborationService.onUsersUpdate((users) => {
        console.log('👥 [CollaborativeEditor] Online users updated:', users.length, users.map(u => u.name));
        setOnlineUsers(users);
        // 更新所有用户光标
        users.forEach(user => {
          if (user.cursor && editorRef.current && monaco) {
            updateUserCursor(user.id, user);
          }
        });
      });

      collaborationService.onCursorUpdate((_userId, user) => {
        if (user.cursor && editorRef.current && monaco) {
          updateUserCursor(_userId, user);
        }
      });

      collaborationService.onContentUpdate((content) => {
        console.log('📝 [CollaborativeEditor] Content updated, length:', content.length);
        onContentChange?.(content);
      });

      collaborationService.onErrorOccurred((error) => {
        console.error('❌ [CollaborativeEditor] Collaboration error:', error);
        setError(error.message);
        setIsLoading(false);
      });

      // 设置初始内容 - 简化逻辑，只在内容为空时设置
      if (initialContent) {
        console.log('📄 [CollaborativeEditor] Setting initial content, length:', initialContent.length);
        collaborationService.setInitialContent(initialContent);
      } else {
        console.log('📄 [CollaborativeEditor] No initial content provided');
      }

    } catch (error) {
      console.error('❌ [CollaborativeEditor] Failed to initialize collaboration service:', error);
      setError('初始化协作服务失败,请点击重试按钮');
      setIsLoading(false);
    }
  }, [documentId, initialContent, onContentChange, monaco, updateUserCursor, agentName]);


  // 处理编辑器挂载
  const handleEditorDidMount = useCallback((editor: any) => {
    console.log('🖥️  [CollaborativeEditor] Monaco editor mounted');
    editorRef.current = editor;

    let retryCount = 0;
    const maxRetries = 50; // 5秒超时 (50 * 100ms)

    // 等待协作服务初始化完成
    const waitForCollaboration = () => {
      retryCount++;

      // 实时检查当前状态,不依赖闭包捕获的值
      const currentCollaboration = collaborationRef.current;
      const currentMonaco = (window as any).monaco;

      console.log(`🔍 [CollaborativeEditor] Checking state... Retry: ${retryCount}/${maxRetries}`, {
        hasCollaboration: !!currentCollaboration,
        hasMonaco: !!currentMonaco,
        hasEditor: !!editor
      });

      if (currentCollaboration && currentMonaco) {
        // 检查 WebSocket 连接状态
        const status = currentCollaboration.getConnectionStatus();
        console.log(`🔄 [CollaborativeEditor] Waiting for connection... Status: ${status}, Retry: ${retryCount}/${maxRetries}`);

        // 只有在已连接时才创建绑定
        if (status === ConnectionStatus.CONNECTED) {
          console.log('✅ [CollaborativeEditor] Creating Monaco-Yjs binding...');

          // 创建 Monaco-Yjs 绑定
          const binding = new MonacoBinding(
            currentCollaboration.getYText(),
            editor.getModel()!,
            new Set([editor])
          );

          bindingRef.current = binding;
          console.log('✅ [CollaborativeEditor] Monaco-Yjs binding created successfully');

          // 监听光标位置变化
          editor.onDidChangeCursorPosition((event: any) => {
            const position = event.position;
            const newPosition = { line: position.lineNumber, column: position.column };

            // 避免频繁发送相同位置
            if (!lastCursorPositionRef.current ||
                lastCursorPositionRef.current.line !== newPosition.line ||
                lastCursorPositionRef.current.column !== newPosition.column) {
              collaborationRef.current?.updateCursor(newPosition.line, newPosition.column);
              lastCursorPositionRef.current = newPosition;
            }
          });

          // 添加保存快捷键
          editor.addCommand(currentMonaco.KeyMod.CtrlCmd | currentMonaco.KeyCode.KeyS, () => {
            const content = editor.getValue();
            onSave?.(content);
          });

          console.log('🎉 [CollaborativeEditor] Initialization complete!');
        } else if (retryCount < maxRetries) {
          // 还在连接中，继续等待
          setTimeout(waitForCollaboration, 100);
        } else {
          console.error('❌ [CollaborativeEditor] Timeout waiting for connection');
          setError('连接超时,请点击重试按钮');
        }
      } else if (retryCount < maxRetries) {
        // 协作服务或 Monaco 还没准备好，继续等待
        console.log(`⏳ [CollaborativeEditor] Waiting for service/monaco... Retry: ${retryCount}/${maxRetries}`);
        setTimeout(waitForCollaboration, 100);
      } else {
        console.error('❌ [CollaborativeEditor] Timeout waiting for collaboration service');
        console.error('   Debug info:', {
          collaborationExists: !!collaborationRef.current,
          monacoExists: !!currentMonaco,
          editorExists: !!editor
        });
        setError('初始化超时,请点击重试按钮');
      }
    };

    waitForCollaboration();
  }, [onSave]);

  // 心跳发送
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      collaborationRef.current?.sendHeartbeat();
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, []);

  // 初始化
  useEffect(() => {
    initializeCollaboration();

    return () => {
      // 清理资源
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }
      if (collaborationRef.current) {
        collaborationRef.current.destroy();
      }
    };
  }, [initializeCollaboration]);

  // 添加自定义 CSS 样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .user-cursor {
        border-left: 2px solid currentColor;
        opacity: 0.8;
      }

      .user-cursor-line {
        border-left: 2px solid currentColor;
        opacity: 0.8;
      }

      .user-cursor-label {
        position: absolute;
        top: -1.2em;
        left: 0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        z-index: 1000;
        background-color: var(--user-color, #666);
        color: #ffffff;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            正在连接协作服务...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
            连接失败
          </h3>
          <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
            {error}
          </p>
          <button
            onClick={initializeCollaboration}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重新连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 顶部工具栏 */}
      <div className={`flex items-center justify-between p-4 border-b ${
        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center space-x-4">
          <ConnectionStatusIndicator
            status={connectionStatus}
            theme={theme}
          />
          <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            文档 ID: {documentId}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <OnlineUsersList
            users={onlineUsers}
            theme={theme}
          />
          {onSave && (
            <button
              onClick={() => {
                const content = editorRef.current?.getValue() || '';
                onSave(content);
              }}
              className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>保存</span>
            </button>
          )}
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height={height}
          language={language}
          theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            selectOnLineNumbers: true,
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            insertSpaces: true,
            cursorStyle: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            mouseWheelZoom: true,
            contextmenu: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on'
          }}
        />
      </div>
    </div>
  );
};

export default CollaborativeEditor;