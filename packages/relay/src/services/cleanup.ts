import cron from 'node-cron';
import { supabase } from '../lib/supabase.js';
import { deleteFile } from './storage.js';
import type { Message } from '../types/index.js';

export function startCleanupJob(): void {
  cron.schedule('0 3 * * *', async () => {
    console.log('[cleanup] Starting expired message cleanup...');
    try {
      const { data: expired, error } = await supabase
        .from('messages')
        .select('id, storage_path')
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('[cleanup] Query failed:', error.message);
        return;
      }

      if (!expired || expired.length === 0) {
        console.log('[cleanup] No expired messages found');
        return;
      }

      for (const msg of expired as Pick<Message, 'id' | 'storage_path'>[]) {
        await deleteFile(msg.storage_path);
        await supabase
          .from('messages')
          .update({ status: 'expired' })
          .eq('id', msg.id);
      }

      console.log(`[cleanup] Cleaned up ${expired.length} expired messages`);
    } catch (err) {
      console.error('[cleanup] Error:', err);
    }
  });

  console.log('[cleanup] Scheduled daily cleanup at 3:00 AM');
}
