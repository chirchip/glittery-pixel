import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendLimiter, inboxLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validation.js';
import { uploadFile, downloadFile } from '../services/storage.js';
import { notifyUser } from '../services/websocket.js';
import { verifyGitHubUsername } from '../services/github.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_EXTENSIONS = ['.md', '.txt', '.yaml', '.yml', '.json', '.toml', '.cfg'];
const MAX_FILE_SIZE = 1_048_576; // 1 MB

function sanitizeFilename(filename: string): string {
  const base = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (base.includes('..') || base.startsWith('/') || base.startsWith('\\')) {
    throw new Error('Invalid filename');
  }
  return base;
}

const sendSchema = z.object({
  to: z.string().min(1).max(39),
  filename: z.string().min(1).max(255),
  content: z.string().min(1),
  note: z.string().max(500).optional(),
});

router.post('/', sendLimiter, validate(sendSchema), async (req, res) => {
  const { to, filename, content, note } = req.body as z.infer<typeof sendSchema>;
  const recipientUsername = to.replace(/^@/, '');

  if (recipientUsername === req.githubUsername) {
    res.status(400).json({ error: 'Cannot send files to yourself' });
    return;
  }

  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    res.status(400).json({
      error: `File type not allowed. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`,
    });
    return;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(content, 'base64').toString('utf-8');
  } catch {
    res.status(400).json({ error: 'Content must be valid base64-encoded UTF-8' });
    return;
  }

  if (Buffer.byteLength(decoded, 'utf-8') > MAX_FILE_SIZE) {
    res.status(400).json({ error: 'File exceeds 1 MB limit' });
    return;
  }

  try {
    const safeName = sanitizeFilename(filename);

    const { data: recipient } = await supabase
      .from('users')
      .select('id')
      .eq('github_username', recipientUsername)
      .single();

    if (!recipient) {
      const ghUser = await verifyGitHubUsername(recipientUsername);
      if (!ghUser) {
        res.status(404).json({ error: `GitHub user @${recipientUsername} not found` });
        return;
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        sender_id: req.userId,
        recipient_github_username: recipientUsername,
        recipient_id: recipient?.id || null,
        filename: safeName,
        file_size_bytes: Buffer.byteLength(decoded, 'utf-8'),
        storage_path: '',
        note: note || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (error || !message) {
      res.status(500).json({ error: 'Failed to create message' });
      return;
    }

    const storagePath = await uploadFile(message.id, safeName, decoded);

    await supabase
      .from('messages')
      .update({ storage_path: storagePath })
      .eq('id', message.id);

    if (recipient?.id) {
      const delivered = notifyUser(recipient.id, {
        id: message.id,
        from: req.githubUsername,
        filename: safeName,
        size_bytes: Buffer.byteLength(decoded, 'utf-8'),
        note: note || null,
        created_at: new Date().toISOString(),
      });

      if (delivered) {
        await supabase
          .from('messages')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', message.id);
      }
    }

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('owner_id', req.userId)
      .eq('contact_github_username', recipientUsername)
      .single();

    if (!existingContact) {
      await supabase.from('contacts').insert({
        owner_id: req.userId!,
        contact_github_username: recipientUsername,
        contact_user_id: recipient?.id || null,
      });
    }

    res.status(201).json({
      id: message.id,
      filename: safeName,
      size_bytes: Buffer.byteLength(decoded, 'utf-8'),
    });
  } catch (err) {
    console.error('[messages] Send error:', err);
    res.status(500).json({ error: 'Failed to send file' });
  }
});

router.get('/inbox', inboxLimiter, async (req, res) => {
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      filename,
      file_size_bytes,
      note,
      status,
      created_at,
      sender:users!messages_sender_id_fkey(github_username, github_name)
    `)
    .eq('recipient_github_username', req.githubUsername)
    .in('status', ['pending', 'delivered'])
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch inbox' });
    return;
  }

  res.json({ messages: messages || [] });
});

router.get('/:id/content', async (req, res) => {
  const { data: message, error } = await supabase
    .from('messages')
    .select('storage_path, recipient_github_username')
    .eq('id', req.params.id)
    .single();

  if (error || !message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  if (message.recipient_github_username !== req.githubUsername) {
    res.status(403).json({ error: 'Not authorized to download this file' });
    return;
  }

  try {
    const content = await downloadFile(message.storage_path);
    res.type('text/plain').send(content);
  } catch {
    res.status(500).json({ error: 'Failed to download file' });
  }
});

const updateSchema = z.object({
  status: z.enum(['saved', 'dismissed']),
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const { status } = req.body as z.infer<typeof updateSchema>;

  const { data: message, error: fetchError } = await supabase
    .from('messages')
    .select('recipient_github_username')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  if (message.recipient_github_username !== req.githubUsername) {
    res.status(403).json({ error: 'Not authorized to update this message' });
    return;
  }

  const { error } = await supabase
    .from('messages')
    .update({ status })
    .eq('id', req.params.id);

  if (error) {
    res.status(500).json({ error: 'Failed to update message' });
    return;
  }

  res.json({ success: true });
});

router.get('/history', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = (page - 1) * limit;

  const { data: sent, error: sentError } = await supabase
    .from('messages')
    .select('id, filename, file_size_bytes, note, status, created_at, recipient_github_username')
    .eq('sender_id', req.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: received, error: receivedError } = await supabase
    .from('messages')
    .select(`
      id, filename, file_size_bytes, note, status, created_at,
      sender:users!messages_sender_id_fkey(github_username)
    `)
    .eq('recipient_github_username', req.githubUsername)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (sentError || receivedError) {
    res.status(500).json({ error: 'Failed to fetch history' });
    return;
  }

  res.json({
    sent: sent || [],
    received: received || [],
    page,
    limit,
  });
});

export default router;
