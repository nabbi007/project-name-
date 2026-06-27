import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { parseExtraction } from '../src/modules/listings/listing-extraction.service';

const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`, pass ? '' : JSON.stringify(detail));
}

function unitTests(): void {
  // 1. Clean JSON
  const a = parseExtraction('{"crop":"Tomato","quantity":10,"unit":"basket","pricePerUnit":180,"availableDate":"2026-07-03","description":"Ten baskets of tomatoes."}');
  check(
    'parses clean JSON + normalises unit',
    !!a && a.extracted.crop === 'Tomato' && a.extracted.unit === 'BASKET' && a.extracted.quantity === 10 && a.incompleteFields.length === 0,
    a
  );

  // 2. JSON wrapped in markdown code fences
  const fenced = '```json\n{"crop":"Maize","quantity":5,"unit":"BAG","pricePerUnit":200,"availableDate":"2026-08-01","description":"Five bags."}\n```';
  const b = parseExtraction(fenced);
  check('strips code fences and parses', !!b && b.extracted.crop === 'Maize' && b.incompleteFields.length === 0, b);

  // 3. Missing/invalid fields flagged
  const c = parseExtraction('{"crop":"Yam","quantity":0,"unit":"WHEELBARROW","pricePerUnit":-5,"availableDate":"not-a-date"}');
  check(
    'flags invalid fields as incomplete',
    !!c &&
      c.incompleteFields.includes('quantity') &&
      c.incompleteFields.includes('unit') &&
      c.incompleteFields.includes('pricePerUnit') &&
      c.incompleteFields.includes('availableDate') &&
      c.incompleteFields.includes('description'),
    c
  );

  // 4. Non-JSON content -> null
  const d = parseExtraction('Sorry, I could not understand the audio.');
  check('returns null for non-JSON', d === null, d);

  // 5. Prose around JSON still extracted
  const e = parseExtraction('Here is the listing: {"crop":"Pepper","quantity":3,"unit":"CRATE","pricePerUnit":90,"availableDate":"2026-07-10","description":"Three crates."} Hope this helps!');
  check('extracts JSON embedded in prose', !!e && e.extracted.crop === 'Pepper' && e.incompleteFields.length === 0, e);
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return (await r.json()).data.token as string;
  };
  const agentToken = await login('agent@agrovoice.test', 'Agent123!');
  const adminToken = await login('admin@agrovoice.test', 'Admin123!');
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const jsonAuth = (t: string) => ({ 'Content-Type': 'application/json', ...auth(t) });

  // Create farmer + session + completed transcripts.
  const farmerUuid = (await (await fetch(`${base}/api/farmers`, {
    method: 'POST', headers: jsonAuth(agentToken),
    body: JSON.stringify({ fullName: `Extract Farmer ${Date.now()}`, consentConfirmed: true }),
  })).json()).data.farmer.uuid;

  const sessionUuid = (await (await fetch(`${base}/api/farmers/${farmerUuid}/voice-sessions`, {
    method: 'POST', headers: jsonAuth(agentToken), body: JSON.stringify({}),
  })).json()).data.session.uuid;

  // Empty session -> NO_TRANSCRIPTS
  const emptyRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}/extract-listing`, { method: 'POST', headers: auth(agentToken) });
  const emptyJson = await emptyRes.json();
  check('empty session returns NO_TRANSCRIPTS', emptyRes.status === 400 && emptyJson.code === 'NO_TRANSCRIPTS', emptyJson);

  // Add completed manual transcripts
  const addResp = async (questionType: string, transcript: string) => {
    const form = new FormData();
    form.append('questionType', questionType);
    form.append('transcript', transcript);
    await fetch(`${base}/api/voice-sessions/${sessionUuid}/responses`, { method: 'POST', headers: auth(agentToken), body: form });
  };
  await addResp('CROP', 'Tomatoes');
  await addResp('QUANTITY', 'Ten baskets');
  await addResp('PRICE', '180 cedis per basket');

  // Extract -> agent not configured -> handled gracefully (503), run logged FAILED
  const extractRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}/extract-listing`, { method: 'POST', headers: auth(agentToken) });
  const extractJson = await extractRes.json();
  const handled = extractJson.success === true || (typeof extractJson.code === 'string' && extractJson.code.startsWith('AGENT_'));
  check('extract is handled gracefully (no 500)', extractRes.status !== 500 && handled, { status: extractRes.status, body: extractJson });

  const runCount = await prisma.aiProcessingRun.count({ where: { apiType: 'AGENT_CHAT' } });
  check('AGENT_CHAT AiProcessingRun logged', runCount >= 1, { runCount });

  // Ownership: other agent cannot extract from this session
  const otherEmail = `eagent_${Date.now()}@test.dev`;
  await fetch(`${base}/api/admin/agents`, { method: 'POST', headers: jsonAuth(adminToken), body: JSON.stringify({ name: 'E Agent', email: otherEmail, password: 'Agent123!' }) });
  const otherToken = await login(otherEmail, 'Agent123!');
  const crossRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}/extract-listing`, { method: 'POST', headers: auth(otherToken) });
  check('other agent cannot extract (404)', crossRes.status === 404, await crossRes.clone().json());

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
