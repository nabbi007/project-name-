import { createApp } from './app';
import { env } from './config/environment';
import { connectDatabase, disconnectDatabase } from './config/database';

async function bootstrap(): Promise<void> {
  const app = createApp();

  try {
    await connectDatabase();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(
      `AgroVoice API running on http://localhost:${env.PORT} (${env.NODE_ENV})`
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      console.log('Server closed. Database disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
