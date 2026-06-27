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

  const adminToken = await login('admin@agrovoice.test', 'Admin123!');
  const agentToken = await login('agent@agrovoice.test', 'Agent123!');
  const buyerToken = await login('buyer@agrovoice.test', 'Buyer123!');
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const jsonAuth = (t: string) => ({ 'Content-Type': 'application/json', ...auth(t) });

  // Setup published listing + order for complaint / farmer confirmation
  const agentUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'agent@agrovoice.test' },
    select: { id: true },
  });
  const category = await prisma.cropCategory.upsert({
    where: { slug: 'onion' },
    update: {},
    create: { name: 'Onion', slug: 'onion', defaultUnit: 'BAG' },
    select: { id: true },
  });
  const farmer = await prisma.farmer.create({
    data: {
      fieldAgentId: agentUser.id,
      fullName: `Gap Farmer ${Date.now()}`,
      status: 'ACTIVE',
      consentConfirmedAt: new Date(),
    },
    select: { id: true },
  });
  const listing = await prisma.produceListing.create({
    data: {
      farmerId: farmer.id,
      fieldAgentId: agentUser.id,
      cropCategoryId: category.id,
      title: 'Onion bags',
      slug: `onion-${Date.now()}`,
      quantity: 20,
      availableQuantity: 20,
      unit: 'BAG',
      pricePerUnit: 50,
      availableDate: new Date(Date.now() + 86400000),
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { uuid: true },
  });

  const orderRes = await fetch(`${base}/api/orders`, {
    method: 'POST',
    headers: jsonAuth(buyerToken),
    body: JSON.stringify({
      listingId: listing.uuid,
      quantity: 2,
      deliveryMethod: 'PICKUP',
      paymentMethod: 'PAY_ON_PICKUP',
    }),
  });
  const orderJson = await orderRes.json();
  const orderUuid = orderJson.data?.order?.uuid;
  check('buyer places order', orderRes.status === 201 && !!orderUuid, orderJson);

  // Complaint flow
  const complaintRes = await fetch(`${base}/api/complaints`, {
    method: 'POST',
    headers: jsonAuth(buyerToken),
    body: JSON.stringify({
      orderId: orderUuid,
      message: 'The onions delivered were not the quantity ordered.',
    }),
  });
  const complaintJson = await complaintRes.json();
  check('buyer files complaint', complaintRes.status === 201 && !!complaintJson.data?.complaint?.uuid, complaintJson);
  const complaintUuid = complaintJson.data?.complaint?.uuid;

  const listComplaints = await fetch(`${base}/api/admin/complaints`, { headers: auth(adminToken) });
  const listJson = await listComplaints.json();
  check('admin lists complaints', listComplaints.status === 200 && Array.isArray(listJson.data), listJson.pagination);

  const resolveRes = await fetch(`${base}/api/admin/complaints/${complaintUuid}`, {
    method: 'PATCH',
    headers: jsonAuth(adminToken),
    body: JSON.stringify({
      status: 'RESOLVED',
      resolution: 'Partial refund issued to buyer.',
    }),
  });
  const resolveJson = await resolveRes.json();
  check('admin resolves complaint', resolveRes.status === 200 && resolveJson.data?.complaint?.status === 'RESOLVED', resolveJson);

  // Farmer order confirmation
  const confirmRes = await fetch(`${base}/api/orders/${orderUuid}/farmer-confirmation`, {
    method: 'POST',
    headers: auth(agentToken),
  });
  const confirmJson = await confirmRes.json();
  check('agent records farmer order confirmation', confirmRes.status === 200 && confirmJson.data?.order?.status === 'CONFIRMED', confirmJson);

  // Voice session complete
  const farmerUuid = (await prisma.farmer.findUnique({ where: { id: farmer.id }, select: { uuid: true } }))!.uuid;
  const sessionUuid = (
    await (
      await fetch(`${base}/api/farmers/${farmerUuid}/voice-sessions`, {
        method: 'POST',
        headers: jsonAuth(agentToken),
        body: JSON.stringify({}),
      })
    ).json()
  ).data.session.uuid;

  const completeRes = await fetch(`${base}/api/voice-sessions/${sessionUuid}/complete`, {
    method: 'POST',
    headers: auth(agentToken),
  });
  const completeJson = await completeRes.json();
  check('voice session marked complete', completeRes.status === 200 && completeJson.data?.session?.status === 'COMPLETED', completeJson);

  // Generated audio farmer-confirmed
  const audio = await prisma.generatedAudio.create({
    data: {
      farmerId: farmer.id,
      messageType: 'LISTING_PUBLISHED',
      textContent: 'Test notification',
      processingStatus: 'COMPLETED',
      audioPath: 'https://example.com/test.wav',
    },
    select: { uuid: true },
  });
  const audioConfirm = await fetch(`${base}/api/generated-audio/${audio.uuid}/farmer-confirmed`, {
    method: 'PATCH',
    headers: auth(agentToken),
  });
  const audioJson = await audioConfirm.json();
  check('generated audio farmer-confirmed', audioConfirm.status === 200 && !!audioJson.data?.audio?.farmerConfirmedAt, audioJson);

  // Admin AI retry endpoint exists (retry a logged AGENT_CHAT run)
  const failedRun = await prisma.aiProcessingRun.findFirst({
    where: { apiType: 'AGENT_CHAT' },
    orderBy: { createdAt: 'desc' },
    select: { uuid: true },
  });
  if (failedRun) {
    const retryRes = await fetch(`${base}/api/admin/ai-runs/${failedRun.uuid}/retry`, {
      method: 'POST',
      headers: auth(adminToken),
    });
    const retryJson = await retryRes.json();
    check(
      'admin AI retry handled (no 500)',
      retryRes.status !== 500 && (retryJson.success === true || typeof retryJson.code === 'string'),
      { status: retryRes.status, code: retryJson.code }
    );
  } else {
    check('admin AI retry endpoint skipped (no AGENT_CHAT runs)', true);
  }

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
