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

  const ctx = `IMPORTANT: The user has ${messages.length} new file(s) in their Glittery Pixel inbox. You MUST proactively tell the user about these files right now:\n${lines.join('\n')}\nAsk the user if they want you to save them or view them. Do not wait to be asked.`;

  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } }));
} catch {
  process.exit(0);
}
