#!/usr/bin/env node
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const configPath = join(homedir(), '.config', 'gp', 'config.json');
const pidPath = join(homedir(), '.config', 'gp', 'listener.pid');
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const incomingPath = join(projectDir, '.claude', 'incoming.jsonl');

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
  process.exit(0);
}

if (!config.auth?.token || !config.relay_url) process.exit(0);

writeFileSync(pidPath, String(process.pid));
mkdirSync(join(projectDir, '.claude'), { recursive: true });

const seenIds = new Set();

async function poll() {
  try {
    const res = await fetch(`${config.relay_url}/messages/inbox`, {
      headers: { Authorization: `Bearer ${config.auth.token}` },
    });

    if (!res.ok) return;

    const { messages } = await res.json();
    if (!messages || messages.length === 0) return;

    const newMessages = messages.filter((m) => !seenIds.has(m.id));
    if (newMessages.length === 0) return;

    for (const m of newMessages) {
      seenIds.add(m.id);
    }

    for (const m of messages) {
      seenIds.add(m.id);
    }

    const lines = newMessages.map((m) =>
      JSON.stringify({
        from: m.sender.github_username,
        filename: m.filename,
        size_bytes: m.file_size_bytes,
        note: m.note || null,
        id: m.id,
      })
    );

    appendFileSync(incomingPath, lines.join('\n') + '\n');
  } catch {}
}

await poll();
setInterval(poll, 30_000);

process.on('SIGTERM', () => {
  try {
    if (existsSync(pidPath)) unlinkSync(pidPath);
  } catch {}
  process.exit(0);
});
