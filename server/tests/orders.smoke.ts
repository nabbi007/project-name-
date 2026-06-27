import { createApp } from '../src/app';
import { prisma } from '../src/config/database';

const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`, pass ? '' : JSON.stringify(detail));
}

const DAY = 24 * 60 * 60 * 1000;

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
    return (await r.json()).data.token as string;
  };
  const register = async (name: string, email: string) => {
    const r = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: 'Buyer123!' }),
    });
    return (await r.json()).data.token as string;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const jsonAuth = (t: string) => ({ 'Content-Type': 'application/json', ...auth(t) });

  const agentToken = await login('agent@agrovoice.test', 'Agent123!');
  const buyerToken = await login('buyer@agrovoice.test', 'Buyer123!');
  const buyer2Token = await register('Buyer Two', `buyer2_${Date.now()}@test.dev`);

  const agent = await prisma.user.findUniqueOrThrow({ where: { email: 'agent@agrovoice.test' }, select: { id: true } });
  const stamp = Date.now();
  const category = await prisma.cropCategory.upsert({ where: { slug: 'maize' }, update: {}, create: { name: 'Maize', slug: 'maize', defaultUnit: 'BAG' }, select: { id: true } });
  const farmer = await prisma.farmer.create({ data: { fieldAgentId: agent.id, fullName: `Order Farmer ${stamp}`, status: 'ACTIVE', consentConfirmedAt: new Date() }, select: { id: true } });
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id, fieldAgentId: agent.id, cropCategoryId: category.id,
      title: 'Maize for sale', slug: `maize-${stamp}`,
      quantity: 5, availableQuantity: 5, unit: 'BAG', pricePerUnit: 100,
      availableDate: new Date(Date.now() + DAY), status: 'PUBLISHED', publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * DAY),
    },
    select: { uuid: true, id: true },
  });

  const availOf = async () => Number((await prisma.produceListing.findUniqueOrThrow({ where: { id: listing.id }, select: { availableQuantity: true } })).availableQuantity);
  const statusOf = async () => (await prisma.produceListing.findUniqueOrThrow({ where: { id: listing.id }, select: { status: true } })).status;

  // 1. Place order (qty 2)
  const orderRes = await fetch(`${base}/api/orders`, {
    method: 'POST', headers: jsonAuth(buyerToken),
    body: JSON.stringify({ listingId: listing.uuid, quantity: 2, deliveryMethod: 'PICKUP', paymentMethod: 'SIMULATED_MOMO' }),
  });
  const orderJson = await orderRes.json();
  const order = orderJson.data?.order;
  check('buyer places order (201, PENDING, total=200, SIMULATED_PAID)',
    orderRes.status === 201 && order?.status === 'PENDING' && Number(order?.totalAmount) === 200 && order?.paymentStatus === 'SIMULATED_PAID', orderJson);
  const orderUuid = order?.uuid;

  // 2. Stock decremented
  check('stock decremented to 3', (await availOf()) === 3);

  // 3. Insufficient stock
  const overRes = await fetch(`${base}/api/orders`, { method: 'POST', headers: jsonAuth(buyerToken), body: JSON.stringify({ listingId: listing.uuid, quantity: 999 }) });
  const overJson = await overRes.json();
  check('insufficient stock rejected (400 INSUFFICIENT_STOCK)', overRes.status === 400 && overJson.code === 'INSUFFICIENT_STOCK', overJson);

  // 4. Non-buyer cannot place order
  const agentOrder = await fetch(`${base}/api/orders`, { method: 'POST', headers: jsonAuth(agentToken), body: JSON.stringify({ listingId: listing.uuid, quantity: 1 }) });
  check('agent cannot place order (403)', agentOrder.status === 403, await agentOrder.clone().json());

  // 5. Buyer lists own orders
  const mine = await (await fetch(`${base}/api/orders/mine`, { headers: auth(buyerToken) })).json();
  check('buyer lists own orders', Array.isArray(mine.data) && mine.data.some((o: any) => o.uuid === orderUuid), mine.pagination);

  // 6. Buyer2 cannot see buyer1 order
  const cross = await fetch(`${base}/api/orders/${orderUuid}`, { headers: auth(buyer2Token) });
  check('other buyer cannot view order (404)', cross.status === 404);

  // 7. Agent sees managed order
  const managed = await (await fetch(`${base}/api/orders`, { headers: auth(agentToken) })).json();
  check('agent lists managed orders', Array.isArray(managed.data) && managed.data.some((o: any) => o.uuid === orderUuid), managed.pagination);

  // 8. Agent confirms
  const confirm = await fetch(`${base}/api/orders/${orderUuid}/status`, { method: 'PATCH', headers: jsonAuth(agentToken), body: JSON.stringify({ status: 'CONFIRMED' }) });
  const confirmJson = await confirm.json();
  check('agent confirms order (CONFIRMED)', confirm.status === 200 && confirmJson.data?.order?.status === 'CONFIRMED', confirmJson);

  // 9. Invalid transition
  const bad = await fetch(`${base}/api/orders/${orderUuid}/status`, { method: 'PATCH', headers: jsonAuth(agentToken), body: JSON.stringify({ status: 'COMPLETED' }) });
  const badJson = await bad.json();
  check('invalid transition rejected (400)', bad.status === 400 && badJson.code === 'INVALID_STATUS_TRANSITION', badJson);

  // 10. Buyer cancels -> stock restored
  const cancel = await fetch(`${base}/api/orders/${orderUuid}/cancel`, { method: 'PATCH', headers: auth(buyerToken) });
  const cancelJson = await cancel.json();
  check('buyer cancels order (CANCELLED)', cancel.status === 200 && cancelJson.data?.order?.status === 'CANCELLED', cancelJson);
  check('stock restored to 5', (await availOf()) === 5);

  // 11. Cannot cancel again
  const cancel2 = await fetch(`${base}/api/orders/${orderUuid}/cancel`, { method: 'PATCH', headers: auth(buyerToken) });
  check('cannot cancel an already-cancelled order (400)', cancel2.status === 400, await cancel2.clone().json());

  // 12. Sold-out behaviour: order all 5
  const big = await fetch(`${base}/api/orders`, { method: 'POST', headers: jsonAuth(buyerToken), body: JSON.stringify({ listingId: listing.uuid, quantity: 5 }) });
  const bigJson = await big.json();
  check('order full stock (201)', big.status === 201, bigJson);
  check('listing marked SOLD_OUT', (await statusOf()) === 'SOLD_OUT');

  // 13. Cancel sold-out order -> listing back to PUBLISHED
  await fetch(`${base}/api/orders/${bigJson.data.order.uuid}/cancel`, { method: 'PATCH', headers: auth(buyerToken) });
  check('listing re-published after restock', (await statusOf()) === 'PUBLISHED' && (await availOf()) === 5);

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
