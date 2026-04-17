import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { isAuthenticated } from '../lib/config.js';
import { success, error, info } from '../lib/display.js';

const HOOK_FILES = ['check-inbox.mjs', 'ws-listener.mjs', 'on-file-received.mjs'];

function getHooksSourceDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), '..', 'hooks');
}

function getClaudeHooksDir(): string {
  return path.join(os.homedir(), '.claude', 'hooks');
}

function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

const GP_HOOKS_CONFIG = {
  hooks: {
    SessionStart: [
      {
        hooks: [
          {
            type: 'command',
            command: `node ${path.join(os.homedir(), '.claude', 'hooks', 'check-inbox.mjs').replace(/\\/g, '/')}`,
            timeout: 10,
          },
          {
            type: 'command',
            command: `node ${path.join(os.homedir(), '.claude', 'hooks', 'ws-listener.mjs').replace(/\\/g, '/')} &`,
            timeout: 5,
          },
        ],
      },
    ],
    FileChanged: [
      {
        matcher: 'incoming.jsonl',
        hooks: [
          {
            type: 'command',
            command: `node ${path.join(os.homedir(), '.claude', 'hooks', 'on-file-received.mjs').replace(/\\/g, '/')}`,
            timeout: 5,
          },
        ],
      },
    ],
    SessionEnd: [
      {
        hooks: [
          {
            type: 'command',
            command: `node -e "const f=require('fs'),p=require('path').join(require('os').homedir(),'.config','gp','listener.pid');if(f.existsSync(p)){try{process.kill(+f.readFileSync(p,'utf8'))}catch{}f.unlinkSync(p)}"`,
            timeout: 5,
          },
        ],
      },
    ],
  },
};

function deepMergeHooks(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'hooks' && typeof value === 'object' && value !== null) {
      const existingHooks = (result.hooks as Record<string, unknown[]>) || {};
      const incomingHooks = value as Record<string, unknown[]>;
      const merged: Record<string, unknown[]> = { ...existingHooks };

      for (const [event, entries] of Object.entries(incomingHooks)) {
        if (!merged[event]) {
          merged[event] = entries;
        } else {
          merged[event] = [...merged[event], ...entries];
        }
      }

      result.hooks = merged;
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function setupHooksCommand(): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gpx auth` first.');
    process.exit(1);
  }

  const sourceDir = getHooksSourceDir();
  const targetDir = getClaudeHooksDir();
  const settingsPath = getClaudeSettingsPath();

  fs.mkdirSync(targetDir, { recursive: true });

  let sourceFound = false;
  for (const file of HOOK_FILES) {
    const src = path.join(sourceDir, file);
    if (!fs.existsSync(src)) {
      const distSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'hooks', file);
      if (fs.existsSync(distSrc)) {
        fs.copyFileSync(distSrc, path.join(targetDir, file));
        sourceFound = true;
      }
    } else {
      fs.copyFileSync(src, path.join(targetDir, file));
      sourceFound = true;
    }
  }

  if (!sourceFound) {
    error('Could not find hook scripts. Try reinstalling: npm install -g glittery-pixel');
    process.exit(1);
  }

  info('  Copied hook scripts to ~/.claude/hooks/');

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {}

  settings = deepMergeHooks(settings, GP_HOOKS_CONFIG);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  info('  Updated ~/.claude/settings.json');

  console.log();
  success('  Claude Code hooks installed!');
  console.log('  New sessions will auto-check your inbox and notify you in real-time.');
  console.log();
}
