import ora from 'ora';
import { isAuthenticated } from '../lib/config.js';
import { apiRequest } from '../lib/api.js';
import { validateFile } from '../lib/validators.js';
import { success, error, formatSize } from '../lib/display.js';
import type { SendResult } from '../types/index.js';

export async function sendCommand(
  recipient: string,
  filePath: string,
  options: { message?: string; force?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    error('Not authenticated. Run `gp auth` first.');
    process.exit(1);
  }

  const username = recipient.replace(/^@/, '');
  if (!username) {
    error('Usage: gp send @username <file>');
    process.exit(1);
  }

  const validation = validateFile(filePath, options.force);

  if (validation.error) {
    error(validation.error);
    process.exit(1);
  }

  if (validation.warning) {
    error(validation.warning);
    process.exit(1);
  }

  if (!validation.valid) {
    error('File validation failed.');
    process.exit(1);
  }

  const spinner = ora(`Sending ${validation.filename} to @${username}...`).start();

  try {
    const encoded = Buffer.from(validation.content).toString('base64');

    const result = await apiRequest<SendResult>('/messages', {
      method: 'POST',
      body: {
        to: username,
        filename: validation.filename,
        content: encoded,
        note: options.message,
      },
    });

    spinner.stop();
    const noteText = options.message ? ', with note' : '';
    success(`  Sent. (${formatSize(result.size_bytes)}${noteText})`);
  } catch (err) {
    spinner.stop();
    error(`Failed to send: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }
}
