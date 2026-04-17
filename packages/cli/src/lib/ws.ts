import WebSocket from 'ws';
import { getToken, getRelayUrl } from './config.js';

interface WsMessage {
  type: string;
  data?: Record<string, unknown>;
}

export function connectWebSocket(
  onMessage: (msg: WsMessage) => void,
  onClose?: () => void
): WebSocket {
  const token = getToken();
  if (!token) throw new Error('Not authenticated. Run `gp auth` first.');

  const relayUrl = getRelayUrl().replace(/^http/, 'ws');
  const ws = new WebSocket(`${relayUrl}/ws?token=${token}`);

  let reconnectTimeout: NodeJS.Timeout | null = null;

  ws.on('open', () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as WsMessage;
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      onMessage(msg);
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    onClose?.();
  });

  ws.on('error', () => {
    // errors are followed by close events
  });

  return ws;
}
