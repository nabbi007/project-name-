import zlib from 'zlib';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import {
  computeCropMatch,
  StructuredObservation,
} from '../src/services/snwolley/vision-structuring.service';

const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`, pass ? '' : JSON.stringify(detail));
}

// Build a valid solid-colour PNG so the Vision API accepts a real image.
function makePng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // colour type RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function unitTests(): void {
  const obs = (crop: string | null): StructuredObservation => ({
    identifiedCrop: crop,
    colour: null,
    maturity: null,
    visibleCondition: null,
    visibleIssues: [],
    recommendation: 'Human review required',
    warning: 'x',
  });
  check('crop match: same crop => MATCH', computeCropMatch('Tomato', obs('Tomato'), 'red tomatoes') === 'MATCH');
  check('crop match: different crop => MISMATCH', computeCropMatch('Tomato', obs('Maize'), 'yellow maize') === 'MISMATCH');
  check('crop match: no expected => MANUAL_REVIEW_REQUIRED', computeCropMatch(null, obs('Tomato'), '') === 'MANUAL_REVIEW_REQUIRED');
  check('crop match: identified empty but description mentions crop => MATCH', computeCropMatch('Tomato', obs(null), 'a basket of fresh tomato') === 'MATCH');
}

async function run(): Promise<void> {
  unitTests();

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
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const jsonAuth = (t: string) => ({ 'Content-Type': 'application/json', ...auth(t) });

  // Setup: crop category + farmer + a DRAFT listing owned by the agent.
  const agentUser = await prisma.user.findUniqueOrThrow({ where: { email: 'agent@agrovoice.test' }, select: { id: true } });
  const category = await prisma.cropCategory.upsert({
    where: { slug: 'tomato' },
    update: {},
    create: { name: 'Tomato', slug: 'tomato', defaultUnit: 'BASKET' },
    select: { id: true, name: true },
  });
  const farmer = await prisma.farmer.create({
    data: { fieldAgentId: agentUser.id, fullName: `Vision Farmer ${Date.now()}` },
    select: { id: true },
  });
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      fieldAgentId: agentUser.id,
      cropCategoryId: category.id,
      title: 'Tomato draft',
      slug: `tomato-${Date.now()}`,
      status: 'DRAFT',
    },
    select: { uuid: true },
  });

  // 1. Upload image
  const form = new FormData();
  const png = makePng(24, 24, [200, 30, 30]);
  form.append('image', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'crop.png');
  form.append('isPrimary', 'true');
  const upRes = await fetch(`${base}/api/listings/${listing.uuid}/images`, { method: 'POST', headers: auth(agentToken), body: form });
  const upJson = await upRes.json();
  check('upload image (201, PENDING)', upRes.status === 201 && upJson.data?.image?.status === 'PENDING', upJson);
  const imageUuid = upJson.data?.image?.uuid;

  // 2. Reject unsupported file type
  const badForm = new FormData();
  badForm.append('image', new Blob([new Uint8Array([1, 2, 3])], { type: 'text/plain' }), 'x.txt');
  const badRes = await fetch(`${base}/api/listings/${listing.uuid}/images`, { method: 'POST', headers: auth(agentToken), body: badForm });
  check('reject unsupported image type (422)', badRes.status === 422, await badRes.clone().json());

  // 3. Analyse (LIVE Vision call with team key)
  const anRes = await fetch(`${base}/api/listing-images/${imageUuid}/analyse`, { method: 'POST', headers: auth(agentToken) });
  const anJson = await anRes.json();
  if (anRes.status === 200) {
    console.log('  LIVE VISION description:', JSON.stringify(String(anJson.data?.image?.visionResponse).slice(0, 160)));
    console.log('  cropMatchStatus:', anJson.data?.cropMatchStatus);
  }
  const analyseHandled = anJson.success === true || (typeof anJson.code === 'string' && (anJson.code.startsWith('VISION_') || anJson.code.startsWith('AGENT_')));
  check('analyse handled gracefully (no 500)', anRes.status !== 500 && analyseHandled, { status: anRes.status, body: anJson });

  // 4. AiProcessingRun VISION logged
  const runCount = await prisma.aiProcessingRun.count({ where: { apiType: 'VISION' } });
  check('VISION AiProcessingRun logged', runCount >= 1, { runCount });

  // 5. Review (APPROVE) -> REVIEWED  (only meaningful if analyse succeeded; works regardless)
  const revRes = await fetch(`${base}/api/listing-images/${imageUuid}/review`, {
    method: 'PATCH', headers: jsonAuth(agentToken),
    body: JSON.stringify({ decision: 'APPROVE', cropMatchStatus: 'MATCH' }),
  });
  const revJson = await revRes.json();
  check('review APPROVE -> REVIEWED', revRes.status === 200 && revJson.data?.image?.status === 'REVIEWED', revJson);

  // 6. Ownership: other agent cannot analyse this image
  const otherEmail = `vsagent_${Date.now()}@test.dev`;
  await fetch(`${base}/api/admin/agents`, { method: 'POST', headers: jsonAuth(adminToken), body: JSON.stringify({ name: 'VS Agent', email: otherEmail, password: 'Agent123!' }) });
  const otherToken = await login(otherEmail, 'Agent123!');
  const crossRes = await fetch(`${base}/api/listing-images/${imageUuid}/analyse`, { method: 'POST', headers: auth(otherToken) });
  check('other agent cannot analyse image (404)', crossRes.status === 404, await crossRes.clone().json());

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
