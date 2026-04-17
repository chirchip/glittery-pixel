#!/usr/bin/env node
import { readFileSync, writeFileSync, appendFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import WebSocket from 'ws';

const configPath = join(homedir(), '.config', 'gp', 'config.json');
const pidPath = join(homedir(), '.config', 'gp', 'listener.pid');
const incomingPath = join(homedir(), '.config', 'gp', 'incoming.jsonl');

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
  process.exit(0);
}

if (!config.auth?.token || !config.relay_url) process.exit(0);

writeFileSync(pidPath, String(process.pid));

function connect() {
  const wsUrl = config.relay_url.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsUrl}/ws?token=${config.auth.token}`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'new_message' && msg.data) {
        appendFileSync(incomingPath, JSON.stringify(msg.data) + '\n');
      }
    } catch {}
  });

  ws.on('close', () => {
    setTimeout(connect, 5000);
  });

  ws.on('error', () => {
    setTimeout(connect, 10000);
  });
}

connect();

process.on('SIGTERM', () => {
  try {
    if (existsSync(pidPath)) unlinkSync(pidPath);
  } catch {}
  process.exit(0);
});
