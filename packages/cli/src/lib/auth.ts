import http from 'http';
import open from 'open';
import { apiRequest } from './api.js';
import { loadConfig, saveConfig } from './config.js';

interface AuthInitResponse {
  auth_url: string;
  state: string;
}

interface AuthCallbackResponse {
  token: string;
  user: {
    id: string;
    github_username: string;
    github_name: string;
    github_avatar_url: string;
  };
  pending_messages: number;
}

export async function performOAuthFlow(): Promise<AuthCallbackResponse> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (!code || !returnedState) {
        res.writeHead(400);
        res.end('Authentication failed: missing code or state');
        server.close();
        reject(new Error('Invalid OAuth callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <h1>Authenticated!</h1>
            <p>You can close this window and return to your terminal.</p>
          </div>
        </body></html>
      `);

      server.close();

      try {
        const result = await apiRequest<AuthCallbackResponse>('/auth/callback', {
          method: 'POST',
          body: { code, state: returnedState },
          requireAuth: false,
        });

        const config = loadConfig();
        const payload = JSON.parse(
          Buffer.from(result.token.split('.')[1], 'base64').toString()
        );

        config.auth = {
          token: result.token,
          github_username: result.user.github_username,
          github_name: result.user.github_name,
          expires_at: new Date(payload.exp * 1000).toISOString(),
        };
        saveConfig(config);

        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to start local server'));
        return;
      }

      const port = addr.port;
      const cliCallback = `http://localhost:${port}/callback`;

      try {
        const { auth_url } = await apiRequest<AuthInitResponse>(
          `/auth/init?cli_callback=${encodeURIComponent(cliCallback)}`,
          { requireAuth: false }
        );

        open(auth_url).catch(() => {
          console.log(`\nOpen this URL in your browser:\n${auth_url}\n`);
        });
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out (5 minutes)'));
    }, 5 * 60 * 1000);
  });
}
