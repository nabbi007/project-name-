import { createApp } from '../src/app';
import { prisma } from '../src/config/database';

const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`, pass ? '' : JSON.stringify(detail));
}

const DAY = 24 * 60 * 60 * 1000;
const SECRET_PHONE = `+2335550${Math.floor(Math.random() * 100000)}`;

async function run(): Promise<void> {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  const agent = await prisma.user.findUniqueOrThrow({ where: { email: 'agent@agrovoice.test' }, select: { id: true } });
  const stamp = Date.now();
  const category = await prisma.cropCategory.upsert({
    where: { slug: 'cassava' },
    update: {},
    create: { name: 'Cassava', slug: 'cassava', defaultUnit: 'BAG' },
    select: { id: true },
  });
  const farmer = await prisma.farmer.create({
    data: {
      fieldAgentId: agent.id,
      fullName: `Market Farmer ${stamp}`,
      phone: SECRET_PHONE,
      region: 'Volta',
      district: 'Ho West',
      community: 'Kpando',
      status: 'ACTIVE',
      consentConfirmedAt: new Date(),
    },
    select: { id: true, uuid: true },
  });

  const mkListing = (overrides: any) =>
    prisma.produceListing.create({
      data: {
        farmerId: farmer.id,
        fieldAgentId: agent.id,
        cropCategoryId: category.id,
        title: 'Fresh cassava',
        slug: `cassava-${stamp}-${Math.random().toString(16).slice(2, 8)}`,
        quantity: 20,
        availableQuantity: 20,
        unit: 'BAG',
        pricePerUnit: 120,
        availableDate: new Date(Date.now() + 3 * DAY),
        region: 'Volta',
        community: 'Kpando',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * DAY),
        ...overrides,
      },
      select: { id: true, uuid: true },
    });

  const published = await mkListing({});
  await prisma.listingImage.create({
    data: { produceListingId: published.id, imagePath: 'uploads/images/test.png', status: 'REVIEWED', cropMatchStatus: 'MATCH', isPrimary: true },
  });
  const draft = await mkListing({ status: 'DRAFT', publishedAt: null });
  await mkListing({ availableQuantity: 0 }); // sold out
  await mkListing({ expiresAt: new Date(Date.now() - DAY) }); // expired

  // 1. Browse (public, no auth)
  const browseRes = await fetch(`${base}/api/marketplace/listings?limit=100`);
  const browseJson = await browseRes.json();
  const uuids = (browseJson.data as any[]).map((l) => l.uuid);
  check('browse returns published listing', browseRes.status === 200 && uuids.includes(published.uuid), browseJson.pagination);
  check('browse hides draft listing', !uuids.includes(draft.uuid));
  check('browse has pagination meta', !!browseJson.pagination && typeof browseJson.pagination.total === 'number', browseJson.pagination);

  // 2. Phone number must never leak
  check('farmer phone is not exposed in browse', !JSON.stringify(browseJson).includes(SECRET_PHONE));

  // 3. Filters
  const cropMatch = await (await fetch(`${base}/api/marketplace/listings?crop=cassava&limit=100`)).json();
  check('crop filter matches', (cropMatch.data as any[]).some((l) => l.uuid === published.uuid));
  const cropNo = await (await fetch(`${base}/api/marketplace/listings?crop=tomato&limit=100`)).json();
  check('crop filter excludes non-matching', !(cropNo.data as any[]).some((l) => l.uuid === published.uuid));
  const priceNo = await (await fetch(`${base}/api/marketplace/listings?minPrice=200&limit=100`)).json();
  check('price filter excludes below min', !(priceNo.data as any[]).some((l) => l.uuid === published.uuid));
  const regionYes = await (await fetch(`${base}/api/marketplace/listings?region=volta&limit=100`)).json();
  check('region filter matches (case-insensitive)', (regionYes.data as any[]).some((l) => l.uuid === published.uuid));

  // 4. Detail
  const detailRes = await fetch(`${base}/api/marketplace/listings/${published.uuid}`);
  const detailJson = await detailRes.json();
  check('public detail of published listing (200)', detailRes.status === 200 && detailJson.data?.listing?.uuid === published.uuid, detailJson);
  check('public detail hides phone', !JSON.stringify(detailJson).includes(SECRET_PHONE));
  const draftDetail = await fetch(`${base}/api/marketplace/listings/${draft.uuid}`);
  check('public detail of draft listing is 404', draftDetail.status === 404, await draftDetail.clone().json());

  // 5. Public farmer profile
  const farmRes = await fetch(`${base}/api/marketplace/farmers/${farmer.uuid}`);
  const farmJson = await farmRes.json();
  check(
    'public farmer profile returns farmer + published listings',
    farmRes.status === 200 && farmJson.data?.farmer?.uuid === farmer.uuid && (farmJson.data?.listings as any[]).some((l) => l.uuid === published.uuid),
    farmJson
  );
  check('public farmer profile hides phone', !JSON.stringify(farmJson).includes(SECRET_PHONE));
  check('public farmer profile excludes draft listing', !(farmJson.data?.listings as any[]).some((l) => l.uuid === draft.uuid));

  server.close();
  await prisma.$disconnect();

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
