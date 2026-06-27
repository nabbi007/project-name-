import zlib from 'zlib';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';

const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`, pass ? '' : JSON.stringify(detail));
}

function makePng(): Buffer {
  const w = 8, h = 8;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.writeUInt8(8, 8); ihdr.writeUInt8(2, 9);
  const raw = Buffer.alloc(h * (1 + w * 3));
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
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
    return (await r.json()).data.token as string;
  };
  const agentToken = await login('agent@agrovoice.test', 'Agent123!');
  const adminToken = await login('admin@agrovoice.test', 'Admin123!');
  const buyerToken = await login('buyer@agrovoice.test', 'Buyer123!');
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const jsonAuth = (t: string) => ({ 'Content-Type': 'application/json', ...auth(t) });

  // 1. Admin creates crop category
  const catName = `Okro ${Date.now()}`;
  const catRes = await fetch(`${base}/api/crop-categories`, {
    method: 'POST', headers: jsonAuth(adminToken),
    body: JSON.stringify({ name: catName, defaultUnit: 'BASKET' }),
  });
  const catJson = await catRes.json();
  check('admin creates crop category', catRes.status === 201 && !!catJson.data?.category?.uuid, catJson);
  const categoryUuid = catJson.data?.category?.uuid;

  // 2. Public can list crop categories (no auth)
  const pubCats = await fetch(`${base}/api/crop-categories`);
  const pubCatsJson = await pubCats.json();
  check('public lists crop categories', pubCats.status === 200 && Array.isArray(pubCatsJson.data?.categories), pubCatsJson);

  // 3. Buyer cannot create category
  const buyerCat = await fetch(`${base}/api/crop-categories`, {
    method: 'POST', headers: jsonAuth(buyerToken), body: JSON.stringify({ name: 'Nope' }),
  });
  check('buyer cannot create category (403)', buyerCat.status === 403, await buyerCat.clone().json());

  // 4. Agent creates a farmer (with consent) + a listing
  const farmerUuid = (await (await fetch(`${base}/api/farmers`, {
    method: 'POST', headers: jsonAuth(agentToken),
    body: JSON.stringify({ fullName: `Listing Farmer ${Date.now()}`, consentConfirmed: true }),
  })).json()).data.farmer.uuid;

  const createRes = await fetch(`${base}/api/listings`, {
    method: 'POST', headers: jsonAuth(agentToken),
    body: JSON.stringify({
      farmerId: farmerUuid,
      cropCategoryId: categoryUuid,
      title: 'Fresh okro',
      quantity: 10,
      unit: 'basket',
      pricePerUnit: 150,
      availableDate: '2026-07-10',
    }),
  });
  const createJson = await createRes.json();
  check('agent creates draft listing', createRes.status === 201 && createJson.data?.listing?.status === 'DRAFT', createJson);
  const listingUuid = createJson.data?.listing?.uuid;

  // 5. List + 6. detail
  const listRes = await fetch(`${base}/api/listings?status=DRAFT`, { headers: auth(agentToken) });
  const listJson = await listRes.json();
  check('agent lists listings with pagination', listRes.status === 200 && !!listJson.pagination && listJson.data.some((l: any) => l.uuid === listingUuid), listJson);

  const detailRes = await fetch(`${base}/api/listings/${listingUuid}`, { headers: auth(agentToken) });
  check('agent gets listing detail', detailRes.status === 200, await detailRes.clone().json());

  // 7. Publish should fail: no image + not agent-confirmed
  const failPub = await fetch(`${base}/api/listings/${listingUuid}/publish`, { method: 'POST', headers: auth(agentToken) });
  const failPubJson = await failPub.json();
  check(
    'publish blocked by requirements (422 with blockers)',
    failPub.status === 422 && Array.isArray(failPubJson.errors?.publication) &&
      failPubJson.errors.publication.some((m: string) => /image/i.test(m)) &&
      failPubJson.errors.publication.some((m: string) => /confirm/i.test(m)),
    failPubJson
  );

  // 8. Add image + confirm
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(makePng())], { type: 'image/png' }), 'okro.png');
  await fetch(`${base}/api/listings/${listingUuid}/images`, { method: 'POST', headers: auth(agentToken), body: form });
  await fetch(`${base}/api/listings/${listingUuid}`, { method: 'PATCH', headers: jsonAuth(agentToken), body: JSON.stringify({ agentConfirmed: true }) });

  // 9. Publish should now succeed
  const pubRes = await fetch(`${base}/api/listings/${listingUuid}/publish`, { method: 'POST', headers: auth(agentToken) });
  const pubJson = await pubRes.json();
  check('publish succeeds when requirements met', pubRes.status === 200 && pubJson.data?.listing?.status === 'PUBLISHED' && !!pubJson.data?.listing?.publishedAt, pubJson);

  // 10. Editing a published listing is blocked
  const editPublished = await fetch(`${base}/api/listings/${listingUuid}`, { method: 'PATCH', headers: jsonAuth(agentToken), body: JSON.stringify({ description: 'x' }) });
  check('published listing cannot be edited (400)', editPublished.status === 400, await editPublished.clone().json());

  // 11. Unpublish -> DRAFT
  const unpub = await fetch(`${base}/api/listings/${listingUuid}/unpublish`, { method: 'POST', headers: auth(agentToken) });
  const unpubJson = await unpub.json();
  check('unpublish returns to DRAFT', unpub.status === 200 && unpubJson.data?.listing?.status === 'DRAFT', unpubJson);

  // 12. Ownership: other agent cannot access this listing
  const otherEmail = `lagent_${Date.now()}@test.dev`;
  await fetch(`${base}/api/admin/agents`, { method: 'POST', headers: jsonAuth(adminToken), body: JSON.stringify({ name: 'L Agent', email: otherEmail, password: 'Agent123!' }) });
  const otherToken = await login(otherEmail, 'Agent123!');
  const cross = await fetch(`${base}/api/listings/${listingUuid}`, { headers: auth(otherToken) });
  check('other agent cannot access listing (404)', cross.status === 404, await cross.clone().json());

  // 13. Invalid create (unsupported unit) -> 422
  const badCreate = await fetch(`${base}/api/listings`, {
    method: 'POST', headers: jsonAuth(agentToken),
    body: JSON.stringify({ farmerId: farmerUuid, unit: 'WHEELBARROW' }),
  });
  check('invalid unit rejected (422)', badCreate.status === 422, await badCreate.clone().json());

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
