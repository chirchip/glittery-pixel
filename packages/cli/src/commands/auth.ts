import ora from 'ora';
import { loadConfig, isAuthenticated, clearAuth, getConfigPath } from '../lib/config.js';
import { performOAuthFlow } from '../lib/auth.js';
import { success, error, info, dim } from '../lib/display.js';

export async function authCommand(): Promise<void> {
  if (isAuthenticated()) {
    const config = loadConfig();
    info(`Already authenticated as @${config.auth!.github_username}`);
    dim('Run `gp auth logout` to sign out, or `gp auth` again to re-authenticate.');
    return;
  }

  console.log('\n  Glittery Pixel -- share AI context files from your terminal.\n');
  console.log('  To get started, we need to verify your GitHub identity.');

  const spinner = ora('Opening browser for GitHub authentication...').start();

  try {
    const result = await performOAuthFlow();
    spinner.stop();

    success(`\n  Authenticated as @${result.user.github_username} (${result.user.github_name || ''})`);
    dim(`  Config saved to ${getConfigPath()}`);

    if (result.pending_messages > 0) {
      info(`\n  You have ${result.pending_messages} file(s) waiting! Run: gp inbox`);
    } else {
      dim('\n  Try: gp send @someone ./CLAUDE.md');
    }
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
}

export function authStatusCommand(): void {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` to sign in.');
    process.exit(1);
  }

  const config = loadConfig();
  const expires = new Date(config.auth!.expires_at);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  console.log(`  Signed in as @${config.auth!.github_username}`);
  console.log(`  Name: ${config.auth!.github_name || '(not set)'}`);
  console.log(`  Relay: ${config.relay_url}`);
  dim(`  Token expires in ${daysLeft} days`);
}

export function authLogoutCommand(): void {
  if (!isAuthenticated()) {
    dim('Not currently authenticated.');
    return;
  }

  const config = loadConfig();
  const username = config.auth!.github_username;
  clearAuth();
  success(`Signed out from @${username}`);
}
