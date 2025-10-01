#!/usr/bin/env node

import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const PORT = process.env.PORT || 1234;

console.log(`🚀 Starting minimal y-websocket server on port ${PORT}`);

// Store documents and connections
const docs = new Map();

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

const setupWSConnection = (conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) => {
  const docName_ = docName;

  if (docs.has(docName_)) {
    const doc = docs.get(docName_);
    conn.doc = doc;
  } else {
    const doc = new Y.Doc();
    conn.doc = doc;
    docs.set(docName_, doc);
  }

  conn.doc.gc = gc;

  if (conn.doc.awareness) {
    conn.awareness = conn.doc.awareness;
  } else {
    conn.awareness = new awarenessProtocol.Awareness(conn.doc);
    conn.doc.awareness = conn.awareness;
  }

  conn.awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated).concat(removed);
    if (origin !== conn) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 1);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(conn.awareness, changedClients));
      if (conn.readyState === 1) {
        conn.send(encoding.toUint8Array(encoder));
      }
    }
  };

  conn.awareness.on('update', conn.awarenessUpdateHandler);

  conn.docUpdateHandler = (update, origin) => {
    if (origin !== conn) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      syncProtocol.writeUpdate(encoder, update);
      if (conn.readyState === 1) {
        conn.send(encoding.toUint8Array(encoder));
      }
    }
  };

  conn.doc.on('update', conn.docUpdateHandler);

  conn.on('message', (message) => {
    try {
      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case 0: // sync
          encoding.writeVarUint(encoder, 0);
          const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, conn.doc, conn);
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder));
          }
          break;
        case 1: // awareness
          awarenessProtocol.applyAwarenessUpdate(conn.awareness, decoding.readVarUint8Array(decoder), conn);
          break;
      }
    } catch (err) {
      console.error('Message handling error:', err);
    }
  });

  // Send initial state
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  syncProtocol.writeSyncStep1(encoder, conn.doc);
  conn.send(encoding.toUint8Array(encoder));

  // Send awareness state
  if (conn.awareness.getStates().size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, 1);
    encoding.writeVarUint8Array(awarenessEncoder, awarenessProtocol.encodeAwarenessUpdate(conn.awareness, Array.from(conn.awareness.getStates().keys())));
    conn.send(encoding.toUint8Array(awarenessEncoder));
  }

  conn.on('close', () => {
    conn.doc.off('update', conn.docUpdateHandler);
    conn.awareness.off('update', conn.awarenessUpdateHandler);
    if (conn.awareness.getStates().has(conn.awareness.clientID)) {
      conn.awareness.setLocalState(null);
    }
  });
};

wss.on('connection', setupWSConnection);

wss.on('listening', () => {
  console.log(`✅ Minimal y-websocket server listening on ws://localhost:${PORT}`);
  console.log('🔗 Fully compatible with y-websocket client protocol');
  console.log('📡 Ready for real-time document collaboration');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down y-websocket server...');

  wss.clients.forEach(ws => {
    ws.close();
  });

  wss.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  wss.close(() => {
    process.exit(0);
  });
});

export { wss };