import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createTwoFilesPatch } from 'diff';
import { isAuthenticated } from '../lib/config.js';
import { apiRequest } from '../lib/api.js';
import { success, error, info, dim, table, formatSize, formatTimeAgo } from '../lib/display.js';
import type { InboxMessage } from '../types/index.js';

let cachedInbox: InboxMessage[] = [];

export async function inboxCommand(): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  try {
    const { messages } = await apiRequest<{ messages: InboxMessage[] }>('/messages/inbox');
    cachedInbox = messages;

    if (messages.length === 0) {
      dim('  No pending files.');
      return;
    }

    console.log();
    info('  Pending files:\n');

    const rows = messages.map((msg, i) => [
      String(i + 1),
      `@${msg.sender.github_username}`,
      msg.filename,
      formatSize(msg.file_size_bytes),
      formatTimeAgo(msg.created_at),
      msg.note || '--',
    ]);

    table(['#', 'From', 'File', 'Size', 'When', 'Note'], rows);

    console.log();
    dim('  Run: gp save <#> [path]    to save a file');
    dim('  Run: gp save --all         to save all to current directory');
    dim('  Run: gp dismiss <#>        to dismiss without saving');
    console.log();
  } catch (err) {
    error(`Failed to fetch inbox: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
}

export async function saveCommand(
  indexOrAll: string,
  destination?: string
): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  if (indexOrAll === '--all') {
    await saveAll(destination || '.');
    return;
  }

  const index = parseInt(indexOrAll) - 1;

  if (cachedInbox.length === 0) {
    const { messages } = await apiRequest<{ messages: InboxMessage[] }>('/messages/inbox');
    cachedInbox = messages;
  }

  if (index < 0 || index >= cachedInbox.length) {
    error(`Invalid index. Run \`gp inbox\` to see pending files.`);
    process.exit(1);
  }

  const msg = cachedInbox[index];
  await saveSingleFile(msg, destination);
}

async function saveSingleFile(msg: InboxMessage, destination?: string): Promise<void> {
  try {
    const content = await apiRequest<string>(`/messages/${msg.id}/content`);

    let savePath: string;
    if (destination) {
      const resolved = path.resolve(destination);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        savePath = path.join(resolved, msg.filename);
      } else {
        savePath = resolved;
      }
    } else {
      savePath = path.resolve(msg.filename);
    }

    if (fs.existsSync(savePath)) {
      const existing = fs.readFileSync(savePath, 'utf-8');
      if (existing === content) {
        dim(`  ${msg.filename} is identical to local copy. Skipping.`);
        await apiRequest(`/messages/${msg.id}`, { method: 'PATCH', body: { status: 'saved' } });
        return;
      }

      const answer = await promptOverwrite(savePath, existing, content);
      if (answer === 'n') {
        dim(`  Skipped ${msg.filename}`);
        return;
      }
    }

    const dir = path.dirname(savePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(savePath, content, 'utf-8');

    await apiRequest(`/messages/${msg.id}`, { method: 'PATCH', body: { status: 'saved' } });
    success(`  Saved ${msg.filename} to ${savePath}`);
  } catch (err) {
    error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function saveAll(dir: string): Promise<void> {
  if (cachedInbox.length === 0) {
    const { messages } = await apiRequest<{ messages: InboxMessage[] }>('/messages/inbox');
    cachedInbox = messages;
  }

  if (cachedInbox.length === 0) {
    dim('  No pending files to save.');
    return;
  }

  for (const msg of cachedInbox) {
    await saveSingleFile(msg, dir);
  }
}

async function promptOverwrite(
  filePath: string,
  existing: string,
  incoming: string
): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(`  ${path.basename(filePath)} already exists. Overwrite? [y/N/diff] `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();

      if (normalized === 'diff') {
        const patch = createTwoFilesPatch(
          `${path.basename(filePath)} (local)`,
          `${path.basename(filePath)} (incoming)`,
          existing,
          incoming
        );
        console.log(patch);
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl2.question('  Overwrite with incoming version? [y/N] ', (answer2) => {
          rl2.close();
          resolve(answer2.trim().toLowerCase() === 'y' ? 'y' : 'n');
        });
        return;
      }

      resolve(normalized === 'y' ? 'y' : 'n');
    });
  });
}

export async function dismissCommand(indexOrAll: string): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  if (indexOrAll === '--all') {
    if (cachedInbox.length === 0) {
      const { messages } = await apiRequest<{ messages: InboxMessage[] }>('/messages/inbox');
      cachedInbox = messages;
    }
    for (const msg of cachedInbox) {
      await apiRequest(`/messages/${msg.id}`, { method: 'PATCH', body: { status: 'dismissed' } });
    }
    success(`  Dismissed ${cachedInbox.length} file(s).`);
    cachedInbox = [];
    return;
  }

  const index = parseInt(indexOrAll) - 1;

  if (cachedInbox.length === 0) {
    const { messages } = await apiRequest<{ messages: InboxMessage[] }>('/messages/inbox');
    cachedInbox = messages;
  }

  if (index < 0 || index >= cachedInbox.length) {
    error('Invalid index. Run `gp inbox` to see pending files.');
    process.exit(1);
  }

  const msg = cachedInbox[index];
  await apiRequest(`/messages/${msg.id}`, { method: 'PATCH', body: { status: 'dismissed' } });
  success(`  Dismissed ${msg.filename} from @${msg.sender.github_username}`);
}
