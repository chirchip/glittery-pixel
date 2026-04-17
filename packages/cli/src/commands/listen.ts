import chalk from 'chalk';
import { isAuthenticated } from '../lib/config.js';
import { connectWebSocket } from '../lib/ws.js';
import { error, info, dim, formatSize } from '../lib/display.js';

export function listenCommand(): void {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  info('  Listening for incoming files... (Ctrl+C to stop)\n');

  const ws = connectWebSocket(
    (msg) => {
      if (msg.type === 'new_message' && msg.data) {
        const d = msg.data as {
          from: string;
          filename: string;
          size_bytes: number;
          note: string | null;
          id: string;
        };

        console.log(
          chalk.bold.cyan(`  New file from @${d.from}: `) +
          `${d.filename} (${formatSize(d.size_bytes)})`
        );
        if (d.note) {
          dim(`    Note: "${d.note}"`);
        }
        dim(`    Run: gp save   to save to current directory`);
        dim(`    Run: gp inbox  to see all pending files`);
        console.log();
      }
    },
    () => {
      dim('  Connection closed. Reconnecting in 5s...');
      setTimeout(() => listenCommand(), 5000);
    }
  );

  process.on('SIGINT', () => {
    ws.close();
    console.log();
    dim('  Stopped listening.');
    process.exit(0);
  });
}
