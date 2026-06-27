import http from 'http';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';

type Res = { status: number; json: any };

function request(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<Res> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json: any = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = data;
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`, pass ? '' : detail ?? '');
}

async function run(): Promise<void> {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  // Clean any prior test buyer so re-runs are deterministic.
  const testEmail = `buyer_${Date.now()}@test.dev`;

  // 1. Admin login
  const adminLogin = await request(port, 'POST', '/api/auth/login', {
    email: 'admin@agrovoice.test',
    password: 'Admin123!',
  });
  check('admin can log in', adminLogin.status === 200 && !!adminLogin.json?.data?.token, adminLogin.json);
  const adminToken = adminLogin.json?.data?.token;

  // 2. Login never returns passwordHash
  check(
    'login response excludes passwordHash',
    adminLogin.json?.data?.user && !('passwordHash' in adminLogin.json.data.user),
    adminLogin.json?.data?.user
  );

  // 3. Admin creates a field agent
  const agentEmail = `agent_${Date.now()}@test.dev`;
  const createAgent = await request(
    port,
    'POST',
    '/api/admin/agents',
    { name: 'New Agent', email: agentEmail, password: 'Agent123!' },
    adminToken
  );
  check('admin creates field agent', createAgent.status === 201 && createAgent.json?.data?.agent?.role === 'FIELD_AGENT', createAgent.json);

  // 4. Public buyer registration
  const register = await request(port, 'POST', '/api/auth/register', {
    name: 'Test Buyer',
    email: testEmail,
    password: 'Buyer123!',
  });
  check('buyer can register', register.status === 201 && register.json?.data?.user?.role === 'BUYER', register.json);
  const buyerToken = register.json?.data?.token;

  // 5. /me with buyer token
  const me = await request(port, 'GET', '/api/auth/me', undefined, buyerToken);
  check('buyer can fetch /me', me.status === 200 && me.json?.data?.user?.email === testEmail, me.json);

  // 6. Buyer cannot create agents (role enforcement)
  const forbidden = await request(
    port,
    'POST',
    '/api/admin/agents',
    { name: 'X', email: `x_${Date.now()}@test.dev`, password: 'Agent123!' },
    buyerToken
  );
  check('buyer is forbidden from admin route', forbidden.status === 403, forbidden.json);

  // 7. Wrong password rejected
  const badLogin = await request(port, 'POST', '/api/auth/login', {
    email: 'admin@agrovoice.test',
    password: 'wrong',
  });
  check('wrong password rejected', badLogin.status === 401, badLogin.json);

  // 8. Validation error shape
  const invalid = await request(port, 'POST', '/api/auth/register', { email: 'nope' });
  check('invalid registration returns 422 with errors', invalid.status === 422 && !!invalid.json?.errors, invalid.json);

  // 9. No token => 401
  const noToken = await request(port, 'GET', '/api/auth/me');
  check('protected route without token returns 401', noToken.status === 401, noToken.json);

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
