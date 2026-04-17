import { supabase } from '../lib/supabase.js';

const BUCKET = 'gp-files';

export async function uploadFile(messageId: string, filename: string, content: string): Promise<string> {
  const path = `messages/${messageId}/${filename}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(content, 'utf-8'), {
      contentType: 'text/plain; charset=utf-8',
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function downloadFile(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return await data.text();
}

export async function deleteFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(`Storage delete failed for ${storagePath}: ${error.message}`);
  }
}
