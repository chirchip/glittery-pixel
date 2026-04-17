import fs from 'fs';
import path from 'path';
import os from 'os';
import type { GpConfig } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'gp');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: GpConfig = {
  version: 1,
  auth: null,
  relay_url: 'http://localhost:8080',
  preferences: {
    default_save_dir: '.',
    auto_overwrite: false,
    notifications: true,
  },
};

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): GpConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: GpConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getToken(): string | null {
  const config = loadConfig();
  return config.auth?.token || null;
}

export function getRelayUrl(): string {
  return loadConfig().relay_url;
}

export function isAuthenticated(): boolean {
  const config = loadConfig();
  if (!config.auth?.token) return false;
  const expires = new Date(config.auth.expires_at);
  return expires > new Date();
}

export function clearAuth(): void {
  const config = loadConfig();
  config.auth = null;
  saveConfig(config);
}
