#!/usr/bin/env node

import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as map from 'lib0/map';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const PORT = 1234;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

console.log(`🚀 Starting collaboration server on port ${PORT}`);

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ port: PORT });

// 存储文档和连接信息
const docs = new Map(); // docname -> Y.Doc
const rooms = new Map(); // docname -> Set of connections
const userColors = new Map(); // userId -> color
const userNames = new Map(); // userId -> userName

// 预定义用户颜色
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
  '#10AC84', '#EE5A24', '#0652DD', '#9C88FF', '#FFC312'
];

let colorIndex = 0;

// 获取用户颜色
function getUserColor(userId) {
  if (!userColors.has(userId)) {
    userColors.set(userId, COLORS[colorIndex % COLORS.length]);
    colorIndex++;
  }
  return userColors.get(userId);
}

// 处理自定义消息
function handleCustomMessage(conn, message, roomName, userId) {
  switch (message.type) {
    case 'cursor-position':
      conn.cursorPosition = message.position;
      broadcastCursorPosition(roomName, userId, message.position);
      break;
    case 'ping':
      conn.isAlive = true;
      conn.send(JSON.stringify({ type: 'pong' }));
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

// 生成用户名
function generateUserName(userId) {
  if (!userNames.has(userId)) {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const adjectives = ['Creative', 'Smart', 'Friendly', 'Bold', 'Clever', 'Bright', 'Quick', 'Wise'];
    const randomName = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
    userNames.set(userId, randomName);
  }
  return userNames.get(userId);
}

// 广播房间用户列表
function broadcastRoomUsers(roomName) {
  const room = rooms.get(roomName);
  if (!room) return;

  const users = [];
  room.forEach(conn => {
    if (conn.readyState === 1 && conn.userId) { // WebSocket.OPEN = 1
      users.push({
        id: conn.userId,
        name: generateUserName(conn.userId),
        color: getUserColor(conn.userId),
        cursor: conn.cursorPosition || null
      });
    }
  });

  const message = JSON.stringify({
    type: 'users-update',
    users: users,
    room: roomName
  });

  room.forEach(conn => {
    if (conn.readyState === 1) {
      try {
        conn.send(message);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    }
  });
}

// 广播光标位置
function broadcastCursorPosition(roomName, userId, position) {
  const room = rooms.get(roomName);
  if (!room) return;

  const message = JSON.stringify({
    type: 'cursor-update',
    userId: userId,
    userName: generateUserName(userId),
    color: getUserColor(userId),
    position: position
  });

  room.forEach(conn => {
    if (conn.readyState === 1 && conn.userId !== userId) {
      try {
        conn.send(message);
      } catch (error) {
        console.error('Error broadcasting cursor to client:', error);
      }
    }
  });
}

// 处理 WebSocket 连接
wss.on('connection', (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.searchParams.get('room') || 'default';
  const userId = url.searchParams.get('userId') || `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  console.log(`📝 New connection to room '${roomName}' from user '${userId}'`);

  // 设置连接属性
  conn.userId = userId;
  conn.roomName = roomName;
  conn.isAlive = true;
  conn.cursorPosition = null;

  // 获取或创建文档
  if (!docs.has(roomName)) {
    const ydoc = new Y.Doc();
    docs.set(roomName, ydoc);
    console.log(`📄 Created new document for room '${roomName}'`);
  }

  // 获取或创建房间
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(conn);

  // 设置 Yjs WebSocket 连接
  const doc = docs.get(roomName);

  // 创建 awareness 实例
  if (!doc.awareness) {
    doc.awareness = new awarenessProtocol.Awareness(doc);
  }

  const awareness = doc.awareness;

  // 处理 WebSocket 消息
  const messageHandler = (data, isBinary) => {
    if (isBinary) {
      const decoder = decoding.createDecoder(data);
      const encoder = encoding.createEncoder();
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case syncProtocol.messageYjsSyncStep1:
          encoding.writeVarUint(encoder, syncProtocol.messageYjsSyncStep2);
          syncProtocol.writeSyncStep2(encoder, doc);
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder));
          }
          break;

        case syncProtocol.messageYjsSyncStep2:
          syncProtocol.readSyncStep2(decoder, doc, conn);
          break;

        case syncProtocol.messageYjsUpdate:
          encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate);
          const update = decoding.readVarUint8Array(decoder);
          Y.applyUpdate(doc, update, conn);
          break;

        case awarenessProtocol.messageAwareness:
          awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), conn);
          break;
      }
    } else {
      // 处理自定义 JSON 消息
      try {
        const message = JSON.parse(data.toString());
        handleCustomMessage(conn, message, roomName, userId);
      } catch (error) {
        console.error('Error parsing JSON message:', error);
      }
    }
  };

  conn.on('message', messageHandler);

  // 发送初始同步
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, syncProtocol.messageYjsSyncStep1);
  syncProtocol.writeSyncStep1(encoder, doc);
  conn.send(encoding.toUint8Array(encoder));

  // 发送初始 awareness 状态
  if (awareness.getStates().size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, awarenessProtocol.messageAwareness);
    encoding.writeVarUint8Array(awarenessEncoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys())));
    conn.send(encoding.toUint8Array(awarenessEncoder));
  }

  // 监听文档更新
  const updateHandler = (update, origin) => {
    if (origin !== conn) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate);
      encoding.writeVarUint8Array(encoder, update);
      conn.send(encoding.toUint8Array(encoder));
    }
  };

  doc.on('update', updateHandler);

  // 监听 awareness 更新
  const awarenessChangeHandler = ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated).concat(removed);
    if (origin !== conn) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, awarenessProtocol.messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
      conn.send(encoding.toUint8Array(encoder));
    }
  };

  awareness.on('change', awarenessChangeHandler);

  // 发送用户信息
  const userInfo = {
    type: 'user-info',
    userId: userId,
    userName: generateUserName(userId),
    color: getUserColor(userId)
  };

  try {
    conn.send(JSON.stringify(userInfo));
  } catch (error) {
    console.error('Error sending user info:', error);
  }

  // 广播用户列表更新
  setTimeout(() => {
    broadcastRoomUsers(roomName);
  }, 100);


  // 处理连接关闭
  conn.on('close', () => {
    console.log(`📤 User '${userId}' disconnected from room '${roomName}'`);

    // 清理事件监听器
    doc.off('update', updateHandler);
    awareness.off('change', awarenessChangeHandler);

    const room = rooms.get(roomName);
    if (room) {
      room.delete(conn);

      // 如果房间为空，可以选择清理文档（这里保留文档以便重连）
      if (room.size === 0) {
        console.log(`🏠 Room '${roomName}' is now empty`);
        // 可选：删除空房间和文档
        // rooms.delete(roomName);
        // docs.delete(roomName);
      } else {
        // 广播用户列表更新
        broadcastRoomUsers(roomName);
      }
    }
  });

  // 错误处理
  conn.on('error', (error) => {
    console.error(`❌ WebSocket error for user '${userId}':`, error);
  });

  // 心跳检测
  conn.on('pong', () => {
    conn.isAlive = true;
  });
});

// 心跳检测定时器
const heartbeat = setInterval(() => {
  wss.clients.forEach((conn) => {
    if (!conn.isAlive) {
      console.log(`💔 Terminating dead connection for user '${conn.userId}'`);
      return conn.terminate();
    }

    conn.isAlive = false;
    conn.ping();
  });
}, HEARTBEAT_INTERVAL);

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down collaboration server...');
  clearInterval(heartbeat);

  wss.clients.forEach(conn => {
    conn.close();
  });

  wss.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

wss.on('listening', () => {
  console.log(`✅ Collaboration server listening on ws://localhost:${PORT}`);
  console.log('🔗 Connect with: ws://localhost:1234?room=<room-name>&userId=<user-id>');
  console.log('📚 Supported message types:');
  console.log('  - cursor-position: { type: "cursor-position", position: { line: number, column: number } }');
  console.log('  - ping: { type: "ping" }');
});

export { wss, docs, rooms };