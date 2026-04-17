import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { supabase } from '../lib/supabase.js';
import { signToken } from '../lib/jwt.js';
import { exchangeCodeForToken, getGitHubUser } from '../services/github.js';
import { validate } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rate-limit.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const pendingStates = new Map<string, { createdAt: number; cliCallback?: string }>();

setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [state, { createdAt }] of pendingStates) {
    if (createdAt < fiveMinutesAgo) pendingStates.delete(state);
  }
}, 60_000);

router.get('/init', authLimiter, (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  const cliCallback = req.query.cli_callback as string | undefined;
  pendingStates.set(state, { createdAt: Date.now(), cliCallback });

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', config.GITHUB_CLIENT_ID);
  authUrl.searchParams.set('scope', 'read:user');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', `${config.RELAY_URL}/auth/github/callback`);

  res.json({ auth_url: authUrl.toString(), state });
});

router.get('/github/callback', authLimiter, (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code || !state || !pendingStates.has(state)) {
    res.status(400).send('Invalid or expired authentication request.');
    return;
  }

  const { cliCallback } = pendingStates.get(state)!;
  if (!cliCallback) {
    res.status(400).send('Missing CLI callback URL.');
    return;
  }

  const redirectUrl = new URL(cliCallback);
  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', state);
  res.redirect(redirectUrl.toString());
});

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

router.post('/callback', authLimiter, validate(callbackSchema), async (req, res) => {
  const { code, state } = req.body as z.infer<typeof callbackSchema>;

  if (!pendingStates.has(state)) {
    res.status(400).json({ error: 'Invalid or expired state parameter' });
    return;
  }
  pendingStates.delete(state);

  try {
    const accessToken = await exchangeCodeForToken(code);
    const ghUser = await getGitHubUser(accessToken);

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('github_username', ghUser.login)
      .single();

    let userId: string;

    if (existing) {
      userId = existing.id;
      await supabase
        .from('users')
        .update({
          github_name: ghUser.name,
          github_avatar_url: ghUser.avatar_url,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } else {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          github_username: ghUser.login,
          github_name: ghUser.name,
          github_avatar_url: ghUser.avatar_url,
        })
        .select('id')
        .single();

      if (error || !newUser) {
        res.status(500).json({ error: 'Failed to create user' });
        return;
      }
      userId = newUser.id;

      await supabase
        .from('messages')
        .update({ recipient_id: userId })
        .eq('recipient_github_username', ghUser.login)
        .is('recipient_id', null);

      await supabase
        .from('contacts')
        .update({ contact_user_id: userId })
        .eq('contact_github_username', ghUser.login)
        .is('contact_user_id', null);
    }

    const token = signToken(userId, ghUser.login);

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_github_username', ghUser.login)
      .eq('status', 'pending');

    res.json({
      token,
      user: {
        id: userId,
        github_username: ghUser.login,
        github_name: ghUser.name,
        github_avatar_url: ghUser.avatar_url,
      },
      pending_messages: count || 0,
    });
  } catch (err) {
    console.error('[auth] Callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/status', authMiddleware, (req, res) => {
  res.json({
    authenticated: true,
    user_id: req.userId,
    github_username: req.githubUsername,
  });
});

export default router;
