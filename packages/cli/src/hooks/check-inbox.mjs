#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const configPath = join(homedir(), '.config', 'gp', 'config.json');

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
  process.exit(0);
}

if (!config.auth?.token || !config.relay_url) process.exit(0);

try {
  const res = await fetch(`${config.relay_url}/messages/inbox`, {
    headers: { Authorization: `Bearer ${config.auth.token}` },
  });

  if (!res.ok) process.exit(0);

  const { messages } = await res.json();
  if (!messages || messages.length === 0) process.exit(0);

  const lines = messages.map((m) => {
    const size =
      m.file_size_bytes >= 1024
        ? `${(m.file_size_bytes / 1024).toFixed(1)} KB`
        : `${m.file_size_bytes} B`;
    return `- ${m.filename} from @${m.sender.github_username} (${size})`;
  });

  const ctx = `You have ${messages.length} new file(s) in your Glittery Pixel inbox:\n${lines.join('\n')}\nRun \`gpx inbox\` to view them, or \`gpx save --all\` to save all.`;

  console.log(JSON.stringify({ hookSpecificOutput: { additionalContext: ctx } }));
} catch {
  process.exit(0);
}
