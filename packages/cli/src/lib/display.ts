import chalk from 'chalk';

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function success(msg: string): void {
  console.log(chalk.green(msg));
}

export function error(msg: string): void {
  console.error(chalk.red(msg));
}

export function info(msg: string): void {
  console.log(chalk.cyan(msg));
}

export function dim(msg: string): void {
  console.log(chalk.dim(msg));
}

export function table(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] || '').length))
  );

  const headerLine = headers
    .map((h, i) => chalk.bold(h.padEnd(colWidths[i])))
    .join('  ');
  console.log(headerLine);

  const separator = colWidths.map(w => '-'.repeat(w)).join('  ');
  console.log(chalk.dim(separator));

  for (const row of rows) {
    const line = row
      .map((cell, i) => (cell || '').padEnd(colWidths[i]))
      .join('  ');
    console.log(line);
  }
}
