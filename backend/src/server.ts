import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { config } from './config';
import { errorHandler, musicRoutes } from './routes/musicRoutes';
import { spotifyApiRouter, spotifyCallbackRouter } from './routes/spotifyRoutes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind a TLS-terminating proxy (Render, Fly, Railway, nginx...) so rate limiting sees the real client IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      // Native apps send no Origin header and are unaffected; this only gates browsers (Expo web).
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      methods: ['GET', 'POST'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.rateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please slow down.' },
    }),
  );

  app.use(express.json({ limit: '2kb' }));

  // Stricter limit on the login endpoints (they create server-side state).
  const authLimiter = rateLimit({ windowMs: 60_000, limit: config.authRateLimitPerMinute, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please wait a minute.' } });
  app.use('/auth', authLimiter);
  app.use('/api/spotify/auth', authLimiter);

  app.use('/auth/spotify', spotifyCallbackRouter);
  app.use('/api/spotify', spotifyApiRouter);
  app.use('/api', musicRoutes);
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}

// Vercel (and other serverless hosts) import this module and use the default export as the request handler.
const app = createApp();
export default app;

// Long-running hosts (Docker, Render, local `npm run dev`) start the module directly and listen on a port.
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Sonara backend listening on http://localhost:${config.port}`);
  });
}
