import { createApp } from '../src/app';
import { prisma } from '../src/config/database';

const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`, pass ? '' : JSON.stringify(detail));
}

async function run(): Promise<void> {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  const login = async (email: string, password: string) => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return { status: r.status, token: (await r.json()).data?.token as string | undefined };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const jsonAuth = (t: string) => ({ 'Content-Type': 'application/json', ...auth(t) });
  const adminToken = (await login('admin@agrovoice.test', 'Admin123!')).token!;
  const agentToken = (await login('agent@agrovoice.test', 'Agent123!')).token!;

  // 1. Dashboard stats
  const statsRes = await fetch(`${base}/api/admin/stats`, { headers: auth(adminToken) });
  const statsJson = await statsRes.json();
  check(
    'admin stats returns aggregates',
    statsRes.status === 200 && typeof statsJson.data?.users?.total === 'number' &&
      !!statsJson.data?.listings?.byStatus && typeof statsJson.data?.orders?.completedRevenue === 'number',
    statsJson
  );

  // 2. List users with filter
  const usersRes = await fetch(`${base}/api/admin/users?role=BUYER&limit=5`, { headers: auth(adminToken) });
  const usersJson = await usersRes.json();
  check('admin lists users (paginated, filtered)', usersRes.status === 200 && Array.isArray(usersJson.data) && !!usersJson.pagination, usersJson.pagination);
  check('user list excludes passwordHash', !JSON.stringify(usersJson).includes('passwordHash'));

  // 3. Suspend / activate an agent
  const email = `suspendme_${Date.now()}@test.dev`;
  const agentCreate = await (await fetch(`${base}/api/admin/agents`, { method: 'POST', headers: jsonAuth(adminToken), body: JSON.stringify({ name: 'Suspend Me', email, password: 'Agent123!' }) })).json();
  const userUuid = agentCreate.data?.agent?.uuid;

  const suspend = await fetch(`${base}/api/admin/users/${userUuid}/status`, { method: 'PATCH', headers: jsonAuth(adminToken), body: JSON.stringify({ status: 'SUSPENDED' }) });
  const suspendJson = await suspend.json();
  check('admin suspends user', suspend.status === 200 && suspendJson.data?.user?.status === 'SUSPENDED', suspendJson);

  const blockedLogin = await login(email, 'Agent123!');
  check('suspended user cannot log in (403)', blockedLogin.status === 403);

  const activate = await fetch(`${base}/api/admin/users/${userUuid}/status`, { method: 'PATCH', headers: jsonAuth(adminToken), body: JSON.stringify({ status: 'ACTIVE' }) });
  check('admin reactivates user', activate.status === 200 && (await activate.json()).data?.user?.status === 'ACTIVE');
  const okLogin = await login(email, 'Agent123!');
  check('reactivated user can log in', okLogin.status === 200);

  // 4. Admin cannot change own status
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@agrovoice.test' }, select: { uuid: true } });
  const self = await fetch(`${base}/api/admin/users/${adminUser.uuid}/status`, { method: 'PATCH', headers: jsonAuth(adminToken), body: JSON.stringify({ status: 'SUSPENDED' }) });
  const selfJson = await self.json();
  check('admin cannot change own status (400)', self.status === 400 && selfJson.code === 'SELF_STATUS_CHANGE', selfJson);

  // 5. Non-admin blocked
  const agentStats = await fetch(`${base}/api/admin/stats`, { headers: auth(agentToken) });
  check('non-admin blocked from admin routes (403)', agentStats.status === 403);

  // 6. AI runs log
  const aiRes = await fetch(`${base}/api/admin/ai-runs?limit=5`, { headers: auth(adminToken) });
  const aiJson = await aiRes.json();
  check('admin lists AI processing runs', aiRes.status === 200 && Array.isArray(aiJson.data) && !!aiJson.pagination, aiJson.pagination);

  // 7. Moderate a listing
  const agentRow = await prisma.user.findUniqueOrThrow({ where: { email: 'agent@agrovoice.test' }, select: { id: true } });
  const category = await prisma.cropCategory.upsert({ where: { slug: 'yam' }, update: {}, create: { name: 'Yam', slug: 'yam', defaultUnit: 'TUBER' }, select: { id: true } });
  const farmer = await prisma.farmer.create({ data: { fieldAgentId: agentRow.id, fullName: `Mod Farmer ${Date.now()}`, status: 'ACTIVE', consentConfirmedAt: new Date() }, select: { id: true } });
  const listing = await prisma.produceListing.create({
    data: { farmerId: farmer.id, fieldAgentId: agentRow.id, cropCategoryId: category.id, title: 'Yam', slug: `yam-${Date.now()}`, quantity: 10, availableQuantity: 10, unit: 'TUBER', pricePerUnit: 5, availableDate: new Date(Date.now() + 86400000), status: 'PENDING_REVIEW' },
    select: { uuid: true },
  });

  const reject = await fetch(`${base}/api/admin/listings/${listing.uuid}/moderate`, { method: 'PATCH', headers: jsonAuth(adminToken), body: JSON.stringify({ decision: 'REJECT', reason: 'Blurry image' }) });
  check('moderate REJECT -> REJECTED', reject.status === 200 && (await reject.json()).data?.listing?.status === 'REJECTED');

  const approve = await fetch(`${base}/api/admin/listings/${listing.uuid}/moderate`, { method: 'PATCH', headers: jsonAuth(adminToken), body: JSON.stringify({ decision: 'APPROVE' }) });
  const approveJson = await approve.json();
  check('moderate APPROVE -> PUBLISHED', approve.status === 200 && approveJson.data?.listing?.status === 'PUBLISHED' && !!approveJson.data?.listing?.publishedAt, approveJson);

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
