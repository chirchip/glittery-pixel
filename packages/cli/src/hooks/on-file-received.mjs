#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const incomingPath = join(projectDir, '.claude', 'incoming.jsonl');

if (!existsSync(incomingPath)) process.exit(0);

let lines;
try {
  const raw = readFileSync(incomingPath, 'utf-8').trim();
  if (!raw) process.exit(0);
  lines = raw.split('\n');
} catch {
  process.exit(0);
}

writeFileSync(incomingPath, '');

const notifications = [];
for (const line of lines) {
  try {
    const msg = JSON.parse(line);
    const size =
      msg.size_bytes >= 1024
        ? `${(msg.size_bytes / 1024).toFixed(1)} KB`
        : `${msg.size_bytes} B`;
    notifications.push(
      `@${msg.from} just sent you ${msg.filename} (${size})${msg.note ? ` -- "${msg.note}"` : ''}`
    );
  } catch {}
}

if (notifications.length === 0) process.exit(0);

const ctx =
  notifications.join('\n') +
  '\nRun `gpx inbox` to view, or ask me to save and read it.';

console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "FileChanged", additionalContext: ctx } }));
process.exit(2);
