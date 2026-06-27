import fs from 'fs';
import path from 'path';
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
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const jsonAuth = (t: string) => ({ 'Content-Type': 'application/json', ...auth(t) });
  const agentToken = await login('agent@agrovoice.test', 'Agent123!');
  const adminToken = await login('admin@agrovoice.test', 'Admin123!');
  const buyerToken = await login('buyer@agrovoice.test', 'Buyer123!');

  const agent = await prisma.user.findUniqueOrThrow({ where: { email: 'agent@agrovoice.test' }, select: { id: true } });
  const stamp = Date.now();
  const category = await prisma.cropCategory.upsert({ where: { slug: 'plantain' }, update: {}, create: { name: 'Plantain', slug: 'plantain', defaultUnit: 'BUNCH' }, select: { id: true } });
  const farmer = await prisma.farmer.create({ data: { fieldAgentId: agent.id, fullName: `Audio Farmer ${stamp}`, status: 'ACTIVE', consentConfirmedAt: new Date() }, select: { id: true } });
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id, fieldAgentId: agent.id, cropCategoryId: category.id,
      title: 'Plantain', slug: `plantain-${stamp}`,
      quantity: 8, availableQuantity: 8, unit: 'BUNCH', pricePerUnit: 60,
      availableDate: new Date(Date.now() + DAY), status: 'PUBLISHED', publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * DAY),
    },
    select: { uuid: true },
  });

  // 1. Generate listing-published audio (LIVE TTS)
  const genRes = await fetch(`${base}/api/listings/${listing.uuid}/audio`, { method: 'POST', headers: auth(agentToken) });
  const genJson = await genRes.json();
  const audio = genJson.data?.audio;
  const handled = genRes.status === 201 || (typeof genJson.code === 'string' && genJson.code.startsWith('TTS_'));
  check('generate listing audio handled (no 500)', genRes.status !== 500 && handled, { status: genRes.status, body: genJson });

  if (genRes.status === 201) {
    check('audio COMPLETED + has path + message text', audio?.processingStatus === 'COMPLETED' && !!audio?.audioPath && /plantain/i.test(audio?.textContent), audio);
    const filePath = path.join(process.cwd(), audio.audioPath);
    const exists = fs.existsSync(filePath);
    const header = exists ? fs.readFileSync(filePath).subarray(0, 4).toString('ascii') : '';
    check('WAV file saved on disk (RIFF header)', exists && header === 'RIFF', { filePath, header });
    console.log('  LIVE TTS wrote', exists ? fs.statSync(filePath).size : 0, 'bytes');

    // 2. Metadata
    const metaRes = await fetch(`${base}/api/generated-audio/${audio.uuid}`, { headers: auth(agentToken) });
    check('get generated audio metadata (200)', metaRes.status === 200, await metaRes.clone().json());

    // 3. Mark played
    const playRes = await fetch(`${base}/api/generated-audio/${audio.uuid}/played`, { method: 'PATCH', headers: auth(agentToken) });
    const playJson = await playRes.json();
    check('mark played sets playedAt', playRes.status === 200 && !!playJson.data?.audio?.playedAt, playJson);

    // 4. Buyer cannot access generated audio
    const buyerGet = await fetch(`${base}/api/generated-audio/${audio.uuid}`, { headers: auth(buyerToken) });
    check('buyer cannot access generated audio (403)', buyerGet.status === 403, await buyerGet.clone().json());
  } else {
    console.log('  TTS not available live; skipped file/metadata checks. Code:', genJson.code);
  }

  // 5. Order notification audio (NEW_ORDER) after a buyer places an order
  const orderRes = await fetch(`${base}/api/orders`, { method: 'POST', headers: jsonAuth(buyerToken), body: JSON.stringify({ listingId: listing.uuid, quantity: 1 }) });
  const orderUuid = (await orderRes.json()).data?.order?.uuid;
  const orderAudioRes = await fetch(`${base}/api/orders/${orderUuid}/audio`, { method: 'POST', headers: jsonAuth(agentToken), body: JSON.stringify({ messageType: 'NEW_ORDER' }) });
  const orderAudioJson = await orderAudioRes.json();
  const orderHandled = orderAudioRes.status === 201 || (typeof orderAudioJson.code === 'string' && orderAudioJson.code.startsWith('TTS_'));
  check('generate order audio handled (no 500)', orderAudioRes.status !== 500 && orderHandled, { status: orderAudioRes.status, body: orderAudioJson });

  // 6. Invalid message type for order
  const badType = await fetch(`${base}/api/orders/${orderUuid}/audio`, { method: 'PATCH', headers: jsonAuth(agentToken), body: JSON.stringify({ messageType: 'LISTING_PUBLISHED' }) });
  // PATCH not defined -> 404; we check POST with bad type instead:
  const badType2 = await fetch(`${base}/api/orders/${orderUuid}/audio`, { method: 'POST', headers: jsonAuth(agentToken), body: JSON.stringify({ messageType: 'LISTING_PUBLISHED' }) });
  check('invalid order message type rejected (422)', badType2.status === 422, await badType2.clone().json());
  void badType;

  // 7. Other agent cannot generate for this listing
  const otherEmail = `aaudio_${Date.now()}@test.dev`;
  await fetch(`${base}/api/admin/agents`, { method: 'POST', headers: jsonAuth(adminToken), body: JSON.stringify({ name: 'A Audio', email: otherEmail, password: 'Agent123!' }) });
  const otherToken = await login(otherEmail, 'Agent123!');
  const cross = await fetch(`${base}/api/listings/${listing.uuid}/audio`, { method: 'POST', headers: auth(otherToken) });
  check('other agent cannot generate listing audio (404)', cross.status === 404, await cross.clone().json());

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
