import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { config } from './config.js';
import { globalLimiter } from './middleware/rate-limit.js';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import contactRoutes from './routes/contacts.js';
import healthRoutes from './routes/health.js';
import { setupWebSocketServer } from './services/websocket.js';
import { startCleanupJob } from './services/cleanup.js';

const app = express();
const server = createServer(app);

app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGINS.split(',').map(o => o.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(globalLimiter);

app.use('/auth', authRoutes);
app.use('/messages', messageRoutes);
app.use('/contacts', contactRoutes);
app.use('/health', healthRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

setupWebSocketServer(server);
startCleanupJob();

const port = parseInt(config.PORT);
server.listen(port, () => {
  console.log(`[server] Glittery Pixel relay running on port ${port}`);
  console.log(`[server] Environment: ${config.NODE_ENV}`);
});

process.on('SIGTERM', () => {
  console.log('[server] Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[server] Shutting down...');
  server.close(() => process.exit(0));
});
