import morgan from 'morgan';
import { isProduction } from '../config/environment';

// HTTP request logging. Uses concise output in production and colourful dev
// output locally. Authentication headers are never logged.
export const requestLogger = morgan(isProduction ? 'combined' : 'dev', {
  // originalUrl is preserved across Express routing, unlike req.url.
  skip: (req) => {
    const url = (req as { originalUrl?: string }).originalUrl ?? req.url ?? '';
    return url.startsWith('/api/health');
  },
});
