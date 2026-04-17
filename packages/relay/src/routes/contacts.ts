import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { verifyGitHubUsername } from '../services/github.js';

const router = Router();
router.use(authMiddleware);

const addContactSchema = z.object({
  github_username: z.string().min(1).max(39),
});

router.post('/', validate(addContactSchema), async (req, res) => {
  const { github_username } = req.body as z.infer<typeof addContactSchema>;
  const username = github_username.replace(/^@/, '');

  if (username === req.githubUsername) {
    res.status(400).json({ error: 'Cannot add yourself as a contact' });
    return;
  }

  const ghUser = await verifyGitHubUsername(username);
  if (!ghUser) {
    res.status(404).json({ error: `GitHub user @${username} not found` });
    return;
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('github_username', username)
    .single();

  const { error } = await supabase.from('contacts').insert({
    owner_id: req.userId!,
    contact_github_username: username,
    contact_user_id: existingUser?.id || null,
  });

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: `@${username} is already in your contacts` });
      return;
    }
    res.status(500).json({ error: 'Failed to add contact' });
    return;
  }

  res.status(201).json({
    github_username: username,
    github_name: ghUser.name,
    on_gp: !!existingUser,
  });
});

router.get('/', async (req, res) => {
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('contact_github_username, contact_user_id, added_at')
    .eq('owner_id', req.userId)
    .order('added_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
    return;
  }

  const enriched = await Promise.all(
    (contacts || []).map(async (c) => {
      const ghUser = await verifyGitHubUsername(c.contact_github_username);
      return {
        github_username: c.contact_github_username,
        github_name: ghUser?.name || null,
        on_gp: !!c.contact_user_id,
        added_at: c.added_at,
      };
    })
  );

  res.json({ contacts: enriched });
});

router.delete('/:username', async (req, res) => {
  const username = req.params.username.replace(/^@/, '');

  const { error, count } = await supabase
    .from('contacts')
    .delete({ count: 'exact' })
    .eq('owner_id', req.userId)
    .eq('contact_github_username', username);

  if (error) {
    res.status(500).json({ error: 'Failed to remove contact' });
    return;
  }

  if (count === 0) {
    res.status(404).json({ error: `@${username} is not in your contacts` });
    return;
  }

  res.json({ success: true });
});

export default router;
