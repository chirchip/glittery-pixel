# Glittery Pixel

Share CLAUDE.md and AI context files directly from your terminal.

## Install

```bash
npm install -g glittery-pixel
```

## Quick start

```bash
gp auth                          # one-time GitHub login
gp send @friend ./CLAUDE.md     # send a file
gp inbox                         # check for incoming files
gp save <id>                     # save a file to current directory
```

## Commands

| Command | Description |
|---------|-------------|
| `gp auth` | Sign in with GitHub |
| `gp send @user <file>` | Send a file (`.md`, `.txt`, `.yaml`, `.json`, `.toml`) |
| `gp inbox` | List pending files |
| `gp save <id>` | Save a file locally |
| `gp dismiss <id>` | Dismiss a file |
| `gp contacts` | List your contacts |
| `gp contacts add @user` | Add a contact |
| `gp listen` | Real-time notifications |
| `gp history` | View sent/received history |
| `gp config` | View/update settings |

## Requirements

- Node.js >= 18
- A GitHub account
