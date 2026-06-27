import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { env } from './config/environment';
import { requestLogger } from './middleware/requestLogger.middleware';
import { globalRateLimiter } from './middleware/rateLimit.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';
import apiRoutes from './routes';

export function createApp(): Application {
  const app = express();

  // Security headers.
  app.use(helmet());

  // Restrict cross-origin requests to the configured frontend.
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    })
  );

  // Body parsing.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging.
  app.use(requestLogger);

  // Serve generated/uploaded media (audio playback etc.) - access control for
  // sensitive files is handled at the route level in later phases.
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'))
  );

  // Global rate limiting for the API surface.
  app.use('/api', globalRateLimiter);

  // API routes.
  app.use('/api', apiRoutes);

  // 404 + global error handling (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
