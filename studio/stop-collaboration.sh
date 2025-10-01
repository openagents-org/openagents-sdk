#!/bin/bash

# 停止协作编辑器服务脚本
echo "🛑 Stopping Collaborative Editor services..."

# 从 PID 文件读取并终止进程
if [ -f ".collaboration.pid" ]; then
    COLLAB_PID=$(cat .collaboration.pid)
    if kill -0 $COLLAB_PID 2>/dev/null; then
        echo "🖥️  Stopping collaboration server (PID: $COLLAB_PID)..."
        kill $COLLAB_PID
    fi
    rm -f .collaboration.pid
fi

if [ -f ".react.pid" ]; then
    REACT_PID=$(cat .react.pid)
    if kill -0 $REACT_PID 2>/dev/null; then
        echo "🌐 Stopping React app (PID: $REACT_PID)..."
        kill $REACT_PID
    fi
    rm -f .react.pid
fi

# 额外清理
echo "🧹 Cleaning up any remaining processes..."
pkill -f "collaboration-server.js" 2>/dev/null || true
pkill -f "craco start" 2>/dev/null || true

echo "✅ All services stopped successfully!"