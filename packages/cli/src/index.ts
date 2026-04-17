#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand, authStatusCommand, authLogoutCommand } from './commands/auth.js';
import { sendCommand } from './commands/send.js';
import { inboxCommand, saveCommand, dismissCommand } from './commands/inbox.js';
import { addContactCommand, listContactsCommand, removeContactCommand } from './commands/contacts.js';
import { listenCommand } from './commands/listen.js';
import { historyCommand } from './commands/history.js';
import { configShowCommand, configSetCommand } from './commands/config.js';
import { setupHooksCommand } from './commands/setup-hooks.js';

const program = new Command();

program
  .name('gp')
  .description('Glittery Pixel -- share AI context files from your terminal')
  .version('0.1.0');

// Auth
const auth = program
  .command('auth')
  .description('Authenticate with GitHub');

auth
  .action(authCommand);

auth
  .command('status')
  .description('Show current auth status')
  .action(authStatusCommand);

auth
  .command('logout')
  .description('Clear local credentials')
  .action(authLogoutCommand);

// Send
program
  .command('send')
  .description('Send a file to a user')
  .argument('<recipient>', 'GitHub username (e.g., @alice)')
  .argument('<file>', 'Path to file to send')
  .option('-m, --message <note>', 'Attach a note to the file')
  .option('--force', 'Send files over 512 KB without warning')
  .action(sendCommand);

// Inbox
program
  .command('inbox')
  .description('List pending received files')
  .action(inboxCommand);

// Save
program
  .command('save')
  .description('Save a pending file to disk')
  .argument('<index>', 'File number from inbox, or --all')
  .argument('[destination]', 'Destination path or directory')
  .action(saveCommand);

// Dismiss
program
  .command('dismiss')
  .description('Dismiss a pending file without saving')
  .argument('<index>', 'File number from inbox, or --all')
  .action(dismissCommand);

// Contacts
const contacts = program
  .command('contacts')
  .description('List your contacts')
  .action(listContactsCommand);

contacts
  .command('remove')
  .description('Remove a contact')
  .argument('<username>', 'GitHub username to remove')
  .action(removeContactCommand);

// Add (shortcut for contacts add)
program
  .command('add')
  .description('Add a contact by GitHub username')
  .argument('<username>', 'GitHub username (e.g., @alice)')
  .action(addContactCommand);

// Listen
program
  .command('listen')
  .description('Listen for incoming files in real-time')
  .action(listenCommand);

// History
program
  .command('history')
  .description('Show recent sent/received file history')
  .action(historyCommand);

// Config
const config = program
  .command('config')
  .description('Show current configuration')
  .action(configShowCommand);

config
  .command('set')
  .description('Set a config value')
  .argument('<key>', 'Config key')
  .argument('<value>', 'Config value')
  .action(configSetCommand);

// Setup
program
  .command('setup-hooks')
  .description('Install Claude Code hooks for real-time inbox notifications')
  .action(setupHooksCommand);

program.parse();
