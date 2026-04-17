import fs from 'fs';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.yaml', '.yml', '.json', '.toml', '.cfg'];
const MAX_FILE_SIZE = 1_048_576; // 1 MB
const SOFT_WARNING_SIZE = 524_288; // 512 KB

export interface FileValidation {
  valid: boolean;
  warning?: string;
  error?: string;
  content: string;
  filename: string;
  sizeBytes: number;
}

export function validateFile(filePath: string, force: boolean = false): FileValidation {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `File not found: ${filePath}`, content: '', filename: '', sizeBytes: 0 };
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return { valid: false, error: `Not a file: ${filePath}`, content: '', filename: '', sizeBytes: 0 };
  }

  const filename = path.basename(resolved);
  const ext = path.extname(filename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type ${ext} not allowed. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`,
      content: '',
      filename,
      sizeBytes: 0,
    };
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  const sizeBytes = Buffer.byteLength(content, 'utf-8');

  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds 1 MB limit (${(sizeBytes / 1024).toFixed(1)} KB)`,
      content: '',
      filename,
      sizeBytes,
    };
  }

  if (sizeBytes > SOFT_WARNING_SIZE && !force) {
    return {
      valid: false,
      warning: `File is ${(sizeBytes / 1024).toFixed(1)} KB. Use --force to send files over 512 KB.`,
      content,
      filename,
      sizeBytes,
    };
  }

  return { valid: true, content, filename, sizeBytes };
}
