import express from 'express';
import cors from 'cors';
import agentRoutes from './routes/agentRoutes.js';
import { resolveLlmProvider } from './config/env.js';
import { getLastDbError, isDbConnected } from './config/db.js';

const isProd = () => String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', isProd() ? 1 : 0);

  const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  app.use(cors({
    origin: function originCheck(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '200kb' }));

  // Minimal in-memory rate limit (per-instance; good enough for free tier).
  const rateStore = new Map();
  app.use((req, res, next) => {
    const key = String(req.ip || 'unknown');
    const now = Date.now();
    const windowMs = 60_000;
    const max = 180;
    const entry = rateStore.get(key);

    if (!entry || now - entry.start > windowMs) {
      rateStore.set(key, { start: now, count: 1 });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ message: 'Too many requests. Please try again shortly.' });
      return;
    }

    next();
  });

  app.get('/health', (req, res) => {
    const { provider } = resolveLlmProvider();
    const dbConnected = isDbConnected();

    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? 'ok' : 'degraded',
      service: 'bookfriend-agent-server',
      llm_provider: provider,
      database: {
        connected: dbConnected,
        error: dbConnected ? null : (getLastDbError()?.message || 'Database unavailable'),
      },
    });
  });

  app.use('/agent', agentRoutes);

  // Centralized error handling.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) return;

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ message: 'Malformed JSON payload.' });
      return;
    }

    const status = Number(err?.statusCode || err?.status || 500);
    const safeStatus = Number.isFinite(status) && status >= 400 && status <= 599 ? status : 500;
    const body = { message: safeStatus >= 500 ? 'Server error.' : (err?.message || 'Request failed.') };
    if (!isProd() && err) body.error = err?.message || String(err);
    res.status(safeStatus).json(body);
  });

  return app;
};

