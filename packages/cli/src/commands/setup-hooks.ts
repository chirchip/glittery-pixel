import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { isAuthenticated } from '../lib/config.js';
import { success, error, info } from '../lib/display.js';

const HOOK_FILES = ['check-inbox.mjs'];

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

function getGpHookEntry() {
  const hookPath = path.join(os.homedir(), '.claude', 'hooks', 'check-inbox.mjs').replace(/\\/g, '/');
  return {
    matcher: '',
    hooks: [
      {
        type: 'command',
        command: `node ${hookPath}`,
        timeout: 10,
      },
    ],
  };
}

function isGpHook(entry: Record<string, unknown>): boolean {
  const hooks = entry.hooks as Array<Record<string, unknown>> | undefined;
  if (!hooks || !Array.isArray(hooks)) return false;
  return hooks.some((h) => typeof h.command === 'string' && h.command.includes('check-inbox.mjs'));
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

  const existingHooks = (settings.hooks as Record<string, unknown[]>) || {};

  const sessionStart = (existingHooks.SessionStart as Array<Record<string, unknown>>) || [];
  const filtered = sessionStart.filter((entry) => !isGpHook(entry));
  filtered.push(getGpHookEntry());

  existingHooks.SessionStart = filtered;
  settings.hooks = existingHooks;

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  info('  Updated ~/.claude/settings.json');

  console.log();
  success('  Claude Code hooks installed!');
  console.log('  Your inbox will be checked each time Claude Code starts.');
  console.log();
}
