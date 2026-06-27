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

  // Create a farmer to attach the session to.
  const farmerRes = await fetch(`${base}/api/farmers`, {
    method: 'POST',
    headers: jsonAuth(agentToken),
    body: JSON.stringify({ fullName: `Voice Farmer ${Date.now()}`, consentConfirmed: true }),
  });
  const farmerUuid = (await farmerRes.json()).data.farmer.uuid;

  // 1. Create voice session
  const sessionRes = await fetch(`${base}/api/farmers/${farmerUuid}/voice-sessions`, {
    method: 'POST',
    headers: jsonAuth(agentToken),
    body: JSON.stringify({}),
  });
  const sessionJson = await sessionRes.json();
  check('create voice session', sessionRes.status === 201 && !!sessionJson.data?.session?.uuid, sessionJson);
  const sessionUuid = sessionJson.data?.session?.uuid;

  // 2. Get session
  const getRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}`, { headers: auth(agentToken) });
  check('get voice session', getRes.status === 200, await getRes.clone().json());

  // 3. Add response with manual transcript (no audio)
  const manualForm = new FormData();
  manualForm.append('questionType', 'CROP');
  manualForm.append('transcript', 'Tomatoes');
  const manualRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}/responses`, {
    method: 'POST',
    headers: auth(agentToken),
    body: manualForm,
  });
  const manualJson = await manualRes.json();
  check(
    'add manual-transcript response (COMPLETED)',
    manualRes.status === 201 && manualJson.data?.response?.processingStatus === 'COMPLETED',
    manualJson
  );

  // 4. Add response with an audio file
  const audioForm = new FormData();
  audioForm.append('questionType', 'PRICE');
  const fakeWav = new Blob([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0])], { type: 'audio/wav' });
  audioForm.append('audio', fakeWav, 'answer.wav');
  const audioRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}/responses`, {
    method: 'POST',
    headers: auth(agentToken),
    body: audioForm,
  });
  const audioJson = await audioRes.json();
  check(
    'add audio response (PENDING)',
    audioRes.status === 201 && audioJson.data?.response?.processingStatus === 'PENDING' && !!audioJson.data?.response?.audioPath,
    audioJson
  );
  const responseUuid = audioJson.data?.response?.uuid;

  // 5. Reject unsupported file type
  const badForm = new FormData();
  badForm.append('questionType', 'UNIT');
  badForm.append('audio', new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }), 'x.pdf');
  const badRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}/responses`, {
    method: 'POST',
    headers: auth(agentToken),
    body: badForm,
  });
  check('reject unsupported audio type (422)', badRes.status === 422, await badRes.clone().json());

  // 6. Transcribe the (intentionally invalid) audio. With no key this returns
  // 503 STT_NOT_CONFIGURED; with a key the API rejects the tiny file with a
  // handled STT_* error. Either way it must be handled gracefully (not 500).
  const transRes = await fetch(`${base}/api/voice-responses/${responseUuid}/transcribe`, {
    method: 'POST',
    headers: auth(agentToken),
  });
  const transJson = await transRes.json();
  const handled =
    transJson.success === true ||
    (typeof transJson.code === 'string' &&
      (transJson.code.startsWith('STT_') || transJson.code === 'EMPTY_TRANSCRIPT'));
  check(
    'transcribe is handled gracefully (no 500)',
    transRes.status !== 500 && handled,
    { status: transRes.status, body: transJson }
  );

  // 7. AiProcessingRun was logged for the attempt
  const runCount = await prisma.aiProcessingRun.count({ where: { apiType: 'SPEECH_TO_TEXT' } });
  check('AiProcessingRun logged', runCount >= 1, { runCount });

  // 8. Manual fallback after failure: correct the transcript
  const correctRes = await fetch(`${base}/api/voice-responses/${responseUuid}/transcript`, {
    method: 'PATCH',
    headers: jsonAuth(agentToken),
    body: JSON.stringify({ transcript: '180 cedis per basket' }),
  });
  const correctJson = await correctRes.json();
  check(
    'manual transcript fallback (COMPLETED)',
    correctRes.status === 200 && correctJson.data?.response?.processingStatus === 'COMPLETED',
    correctJson
  );

  // 9. Cross-agent ownership: second agent cannot read this session
  const otherEmail = `vagent_${Date.now()}@test.dev`;
  await fetch(`${base}/api/admin/agents`, {
    method: 'POST',
    headers: jsonAuth(adminToken),
    body: JSON.stringify({ name: 'V Agent', email: otherEmail, password: 'Agent123!' }),
  });
  const otherToken = await login(otherEmail, 'Agent123!');
  const crossRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}`, { headers: auth(otherToken) });
  check('other agent cannot access session (404)', crossRes.status === 404, await crossRes.clone().json());

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
