import http from 'http';
import { createApp } from '../src/app';

async function run(): Promise<void> {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  const get = (path: string): Promise<{ status: number; body: string }> =>
    new Promise((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port, path }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, body: data })
          );
        })
        .on('error', reject);
    });

  const health = await get('/api/health');
  console.log('HEALTH', health.status, health.body);

  const notFound = await get('/api/does-not-exist');
  console.log('NOTFOUND', notFound.status, notFound.body);

  server.close();

  const ok = health.status === 200 && JSON.parse(health.body).success === true;
  if (!ok) {
    console.error('Smoke test FAILED');
    process.exit(1);
  }
  console.log('Smoke test PASSED');
  process.exit(0);
}

run();
