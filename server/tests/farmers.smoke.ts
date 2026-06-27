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

async function login(port: number, email: string, password: string) {
  const r = await request(port, 'POST', '/api/auth/login', { email, password });
  return r.json?.data?.token as string;
}

async function run(): Promise<void> {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  const adminToken = await login(port, 'admin@agrovoice.test', 'Admin123!');
  const agentToken = await login(port, 'agent@agrovoice.test', 'Agent123!');

  // Admin creates a second agent for the cross-ownership test.
  const otherAgentEmail = `agent2_${Date.now()}@test.dev`;
  await request(
    port,
    'POST',
    '/api/admin/agents',
    { name: 'Second Agent', email: otherAgentEmail, password: 'Agent123!' },
    adminToken
  );
  const otherAgentToken = await login(port, otherAgentEmail, 'Agent123!');

  // 1. Agent registers a farmer
  const uniqueName = `Kwame ${Date.now()}`;
  const created = await request(
    port,
    'POST',
    '/api/farmers',
    {
      fullName: uniqueName,
      phone: '+233244000111',
      region: 'Ashanti',
      community: 'Ejisu',
      preferredLanguage: 'Twi',
      consentConfirmed: true,
    },
    agentToken
  );
  check('agent registers farmer', created.status === 201 && !!created.json?.data?.farmer?.uuid, created.json);
  const farmerUuid = created.json?.data?.farmer?.uuid;
  check('consent timestamp recorded', !!created.json?.data?.farmer?.consentConfirmedAt, created.json?.data?.farmer);

  // 2. Agent lists farmers (search)
  const listed = await request(port, 'GET', `/api/farmers?search=${encodeURIComponent(uniqueName)}`, undefined, agentToken);
  check('agent searches own farmers', listed.status === 200 && listed.json?.data?.some((f: any) => f.uuid === farmerUuid), listed.json);
  check('list returns pagination meta', !!listed.json?.pagination, listed.json);

  // 3. Agent gets farmer detail
  const detail = await request(port, 'GET', `/api/farmers/${farmerUuid}`, undefined, agentToken);
  check('agent gets own farmer', detail.status === 200 && detail.json?.data?.farmer?.uuid === farmerUuid, detail.json);

  // 4. Agent updates farmer
  const updated = await request(port, 'PATCH', `/api/farmers/${farmerUuid}`, { district: 'Ejisu-Juaben' }, agentToken);
  check('agent updates farmer', updated.status === 200 && updated.json?.data?.farmer?.district === 'Ejisu-Juaben', updated.json);

  // 5. Agent updates status
  const statusUpdated = await request(port, 'PATCH', `/api/farmers/${farmerUuid}/status`, { status: 'INACTIVE' }, agentToken);
  check('agent updates farmer status', statusUpdated.status === 200 && statusUpdated.json?.data?.farmer?.status === 'INACTIVE', statusUpdated.json);

  // 6. Other agent cannot access this farmer (ownership) -> 404
  const crossAccess = await request(port, 'GET', `/api/farmers/${farmerUuid}`, undefined, otherAgentToken);
  check('other agent cannot access farmer (404)', crossAccess.status === 404, crossAccess.json);

  // 7. Admin can access any farmer
  const adminAccess = await request(port, 'GET', `/api/farmers/${farmerUuid}`, undefined, adminToken);
  check('admin can access any farmer', adminAccess.status === 200, adminAccess.json);

  // 8. Buyer is forbidden from farmer routes
  const buyerToken = await login(port, 'buyer@agrovoice.test', 'Buyer123!');
  const buyerForbidden = await request(port, 'GET', '/api/farmers', undefined, buyerToken);
  check('buyer is forbidden from farmer routes (403)', buyerForbidden.status === 403, buyerForbidden.json);

  // 9. Validation error on bad create
  const badCreate = await request(port, 'POST', '/api/farmers', { fullName: 'x' }, agentToken);
  check('invalid farmer create returns 422', badCreate.status === 422 && !!badCreate.json?.errors, badCreate.json);

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
