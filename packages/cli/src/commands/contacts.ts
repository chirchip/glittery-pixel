import ora from 'ora';
import { isAuthenticated } from '../lib/config.js';
import { apiRequest } from '../lib/api.js';
import { success, error, dim, table } from '../lib/display.js';
import type { ContactInfo } from '../types/index.js';

export async function addContactCommand(username: string): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  const clean = username.replace(/^@/, '');
  const spinner = ora(`Looking up @${clean} on GitHub...`).start();

  try {
    const result = await apiRequest<ContactInfo>('/contacts', {
      method: 'POST',
      body: { github_username: clean },
    });

    spinner.stop();
    const name = result.github_name ? ` (${result.github_name})` : '';
    success(`  Added @${clean}${name} to your contacts.`);
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
}

export async function listContactsCommand(): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  try {
    const { contacts } = await apiRequest<{ contacts: ContactInfo[] }>('/contacts');

    if (contacts.length === 0) {
      dim('  No contacts yet. Run `gp add @username` to add someone.');
      return;
    }

    console.log();
    const rows = contacts.map(c => [
      `@${c.github_username}`,
      c.github_name || '(unknown)',
      c.on_gp ? '(on gp)' : '(not on gp yet)',
    ]);

    table(['Username', 'Name', 'Status'], rows);
    console.log();
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
}

export async function removeContactCommand(username: string): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  const clean = username.replace(/^@/, '');

  try {
    await apiRequest(`/contacts/${clean}`, { method: 'DELETE' });
    success(`  Removed @${clean} from contacts.`);
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
}
