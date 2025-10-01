#!/bin/bash

# 协作编辑器启动脚本
echo "🚀 Starting Collaborative Editor Demo"

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the studio directory"
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "⚠️  Warning: Node.js 16+ is recommended for best compatibility"
fi

# 停止现有进程（如果有）
echo "🧹 Cleaning up existing processes..."
pkill -f "collaboration-server.js" 2>/dev/null || true
pkill -f "craco start" 2>/dev/null || true

# 启动协作服务器
echo "🖥️  Starting collaboration server..."
cd server
node collaboration-server.js &
COLLAB_PID=$!
cd ..

# 等待服务器启动
echo "⏳ Waiting for collaboration server to start..."
sleep 3

# 检查服务器是否启动成功
if ! curl -s ws://localhost:1234 > /dev/null 2>&1; then
    echo "⚠️  Collaboration server may not be fully ready, but continuing..."
fi

# 启动前端应用
echo "🌐 Starting React application..."
PORT=8050 HOST=0.0.0.0 DANGEROUSLY_DISABLE_HOST_CHECK=true npm start &
REACT_PID=$!

# 保存 PID 文件以便后续清理
echo $COLLAB_PID > .collaboration.pid
echo $REACT_PID > .react.pid

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📡 Collaboration Server: ws://localhost:1234"
echo "🌐 React App: http://localhost:8050"
echo ""
echo "🔗 To test collaboration:"
echo "   1. Open http://localhost:8050 in your browser"
echo "   2. Navigate to Documents → Click on a document"
echo "   3. Open the same URL in another browser/tab"
echo "   4. Start typing in both windows to see real-time sync!"
echo ""
echo "🛑 To stop all services, run: ./stop-collaboration.sh"
echo ""

# 等待用户中断
trap 'echo ""; echo "🛑 Shutting down..."; kill $COLLAB_PID $REACT_PID 2>/dev/null; rm -f .collaboration.pid .react.pid; exit 0' INT

echo "Press Ctrl+C to stop all services"
wait