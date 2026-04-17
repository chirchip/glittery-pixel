import { isAuthenticated } from '../lib/config.js';
import { apiRequest } from '../lib/api.js';
import { error, dim, info, table, formatSize, formatTimeAgo } from '../lib/display.js';
import type { HistoryItem } from '../types/index.js';

export async function historyCommand(): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  try {
    const { sent, received } = await apiRequest<{
      sent: HistoryItem[];
      received: HistoryItem[];
    }>('/messages/history');

    if (sent.length === 0 && received.length === 0) {
      dim('  No history yet.');
      return;
    }

    if (sent.length > 0) {
      console.log();
      info('  Sent:');
      console.log();
      table(
        ['To', 'File', 'Size', 'When', 'Status'],
        sent.map(m => [
          `@${m.recipient_github_username || '?'}`,
          m.filename,
          formatSize(m.file_size_bytes),
          formatTimeAgo(m.created_at),
          m.status,
        ])
      );
    }

    if (received.length > 0) {
      console.log();
      info('  Received:');
      console.log();
      table(
        ['From', 'File', 'Size', 'When', 'Status'],
        received.map(m => [
          `@${m.sender?.github_username || '?'}`,
          m.filename,
          formatSize(m.file_size_bytes),
          formatTimeAgo(m.created_at),
          m.status,
        ])
      );
    }

    console.log();
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
}
