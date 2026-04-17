import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyToken } from '../lib/jwt.js';

const connections = new Map<string, WebSocket>();

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    try {
      const payload = verifyToken(token);
      const userId = payload.sub;

      const existing = connections.get(userId);
      if (existing && existing.readyState === WebSocket.OPEN) {
        existing.close(4002, 'New connection opened');
      }

      connections.set(userId, ws);

      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30_000);

      ws.on('close', () => {
        clearInterval(pingInterval);
        if (connections.get(userId) === ws) {
          connections.delete(userId);
        }
      });

      ws.on('error', () => {
        clearInterval(pingInterval);
        if (connections.get(userId) === ws) {
          connections.delete(userId);
        }
      });
    } catch {
      ws.close(4001, 'Invalid token');
    }
  });

  return wss;
}

export function notifyUser(userId: string, data: Record<string, unknown>): boolean {
  const ws = connections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'new_message', data }));
    return true;
  }
  return false;
}

export function getConnectedUserCount(): number {
  return connections.size;
}
