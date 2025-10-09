#!/bin/bash

# Collaborative editor startup script
echo "🚀 Starting Collaborative Editor Demo"

# Check if in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the studio directory"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "⚠️  Warning: Node.js 16+ is recommended for best compatibility"
fi

# Stop existing processes (if any)
echo "🧹 Cleaning up existing processes..."
pkill -f "collaboration-server.js" 2>/dev/null || true
pkill -f "y-websocket-server" 2>/dev/null || true
pkill -f "craco start" 2>/dev/null || true

# Start collaboration server
echo "🖥️  Starting collaboration server..."
cd server
node y-websocket-server.js &
COLLAB_PID=$!
cd ..

# Wait for server to start
echo "⏳ Waiting for collaboration server to start..."
sleep 3

# Check if server started successfully
if ! curl -s ws://localhost:1234 > /dev/null 2>&1; then
    echo "⚠️  Collaboration server may not be fully ready, but continuing..."
fi

# Start frontend application
echo "🌐 Starting React application..."
PORT=8050 HOST=0.0.0.0 DANGEROUSLY_DISABLE_HOST_CHECK=true npm start &
REACT_PID=$!

# Save PID files for later cleanup
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

# Wait for user interrupt
trap 'echo ""; echo "🛑 Shutting down..."; kill $COLLAB_PID $REACT_PID 2>/dev/null; rm -f .collaboration.pid .react.pid; exit 0' INT

echo "Press Ctrl+C to stop all services"
wait