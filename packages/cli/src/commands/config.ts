import { loadConfig, saveConfig, getConfigPath } from '../lib/config.js';
import { success, error, dim } from '../lib/display.js';

const SETTABLE_KEYS: Record<string, string> = {
  relay_url: 'Relay server URL',
  'preferences.default_save_dir': 'Default directory for saved files',
  'preferences.auto_overwrite': 'Auto-overwrite existing files (true/false)',
  'preferences.notifications': 'Enable notifications (true/false)',
};

export function configShowCommand(): void {
  const config = loadConfig();
  console.log();
  dim(`  Config file: ${getConfigPath()}`);
  console.log();
  console.log(`  Relay URL:        ${config.relay_url}`);
  console.log(`  Default save dir: ${config.preferences.default_save_dir}`);
  console.log(`  Auto overwrite:   ${config.preferences.auto_overwrite}`);
  console.log(`  Notifications:    ${config.preferences.notifications}`);

  if (config.auth) {
    console.log(`  Authenticated as: @${config.auth.github_username}`);
  } else {
    console.log('  Not authenticated');
  }
  console.log();
}

export function configSetCommand(key: string, value: string): void {
  if (!SETTABLE_KEYS[key]) {
    error(`Unknown config key: ${key}`);
    dim(`  Available keys: ${Object.keys(SETTABLE_KEYS).join(', ')}`);
    process.exit(1);
  }

  const config = loadConfig();

  if (key === 'relay_url') {
    config.relay_url = value;
  } else if (key.startsWith('preferences.')) {
    const prefKey = key.split('.')[1] as keyof typeof config.preferences;
    if (typeof config.preferences[prefKey] === 'boolean') {
      (config.preferences as Record<string, unknown>)[prefKey] = value === 'true';
    } else {
      (config.preferences as Record<string, unknown>)[prefKey] = value;
    }
  }

  saveConfig(config);
  success(`  Set ${key} = ${value}`);
}
