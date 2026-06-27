import {
  Prisma,
  UserRole,
  ListingStatus,
  FarmerStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { PaginationMeta, buildPagination } from '../../utils/apiResponse';
import { uniqueSlug } from '../../utils/slug';
import {
  CreateListingInput,
  ListListingsQuery,
  UpdateListingInput,
} from './listings.validators';

export interface Actor {
  id: number;
  role: UserRole;
}

// Statuses a listing may still be edited in.
const EDITABLE_STATUSES: ListingStatus[] = [
  ListingStatus.DRAFT,
  ListingStatus.PROCESSING,
  ListingStatus.PENDING_REVIEW,
  ListingStatus.REJECTED,
];

const listSelect = {
  uuid: true,
  title: true,
  slug: true,
  description: true,
  quantity: true,
  availableQuantity: true,
  unit: true,
  pricePerUnit: true,
  availableDate: true,
  expiresAt: true,
  region: true,
  community: true,
  agentConfirmed: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  cropCategory: { select: { uuid: true, name: true, slug: true } },
  farmer: {
    select: { uuid: true, fullName: true, displayName: true, region: true, community: true, status: true },
  },
  images: {
    select: {
      uuid: true,
      imagePath: true,
      status: true,
      cropMatchStatus: true,
      isPrimary: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProduceListingSelect;

const detailSelect = {
  ...listSelect,
  visionDescription: true,
  visualObservation: true,
  farmer: {
    select: {
      uuid: true,
      fullName: true,
      displayName: true,
      phone: true,
      region: true,
      community: true,
      status: true,
      consentConfirmedAt: true,
    },
  },
  images: {
    select: {
      uuid: true,
      imagePath: true,
      status: true,
      cropMatchStatus: true,
      isPrimary: true,
      visionResponse: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProduceListingSelect;

function scope(actor: Actor): Prisma.ProduceListingWhereInput {
  return actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id };
}

// Moves expired published listings to EXPIRED. Cheap targeted update.
export async function expireOldListings(): Promise<void> {
  await prisma.produceListing.updateMany({
    where: {
      status: ListingStatus.PUBLISHED,
      expiresAt: { not: null, lt: new Date() },
    },
    data: { status: ListingStatus.EXPIRED },
  });
}

async function resolveOwnedFarmerId(actor: Actor, farmerUuid: string): Promise<number> {
  const farmer = await prisma.farmer.findFirst({
    where: {
      uuid: farmerUuid,
      ...(actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id }),
    },
    select: { id: true },
  });
  if (!farmer) throw AppError.notFound('Farmer not found');
  return farmer.id;
}

async function resolveCropCategoryId(uuid?: string): Promise<number | undefined> {
  if (!uuid) return undefined;
  const category = await prisma.cropCategory.findUnique({
    where: { uuid },
    select: { id: true },
  });
  if (!category) throw AppError.badRequest('Invalid crop category', 'INVALID_CATEGORY');
  return category.id;
}

export async function createListing(actor: Actor, input: CreateListingInput) {
  const farmerId = await resolveOwnedFarmerId(actor, input.farmerId);
  const cropCategoryId = await resolveCropCategoryId(input.cropCategoryId);

  const title = input.title ?? 'Draft listing';

  return prisma.produceListing.create({
    data: {
      farmerId,
      fieldAgentId: actor.id,
      cropCategoryId,
      title,
      slug: uniqueSlug(title),
      description: input.description,
      quantity: input.quantity ?? 0,
      availableQuantity: input.quantity ?? 0,
      unit: input.unit,
      pricePerUnit: input.pricePerUnit ?? 0,
      availableDate: input.availableDate,
      expiresAt: input.expiresAt,
      region: input.region,
      community: input.community,
      status: ListingStatus.DRAFT,
    },
    select: detailSelect,
  });
}

export async function listListings(
  actor: Actor,
  query: ListListingsQuery
): Promise<{ listings: unknown[]; pagination: PaginationMeta }> {
  await expireOldListings();

  const where: Prisma.ProduceListingWhereInput = { ...scope(actor) };
  if (query.status) where.status = query.status;
  if (query.cropCategoryId) {
    where.cropCategory = { uuid: query.cropCategoryId };
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, listings] = await Promise.all([
    prisma.produceListing.count({ where }),
    prisma.produceListing.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { listings, pagination: buildPagination(query.page, query.limit, total) };
}

export async function getListing(actor: Actor, uuid: string) {
  const listing = await prisma.produceListing.findFirst({
    where: { uuid, ...scope(actor) },
    select: detailSelect,
  });
  if (!listing) throw AppError.notFound('Listing not found');
  return listing;
}

async function resolveOwnedListing(actor: Actor, uuid: string) {
  const listing = await prisma.produceListing.findFirst({
    where: { uuid, ...scope(actor) },
    select: { id: true, status: true },
  });
  if (!listing) throw AppError.notFound('Listing not found');
  return listing;
}

export async function updateListing(
  actor: Actor,
  uuid: string,
  input: UpdateListingInput
) {
  const listing = await resolveOwnedListing(actor, uuid);
  if (!EDITABLE_STATUSES.includes(listing.status)) {
    throw AppError.badRequest(
      `A listing with status ${listing.status} cannot be edited. Unpublish it first.`,
      'LISTING_NOT_EDITABLE'
    );
  }

  const cropCategoryId = await resolveCropCategoryId(input.cropCategoryId);

  const data: Prisma.ProduceListingUpdateInput = {
    description: input.description,
    title: input.title,
    unit: input.unit,
    region: input.region,
    community: input.community,
    availableDate: input.availableDate,
    expiresAt: input.expiresAt,
  };
  if (input.quantity !== undefined) {
    data.quantity = input.quantity;
    data.availableQuantity = input.quantity;
  }
  if (input.pricePerUnit !== undefined) data.pricePerUnit = input.pricePerUnit;
  if (input.agentConfirmed !== undefined) data.agentConfirmed = input.agentConfirmed;
  if (cropCategoryId !== undefined) {
    data.cropCategory = { connect: { id: cropCategoryId } };
  }

  return prisma.produceListing.update({
    where: { id: listing.id },
    data,
    select: detailSelect,
  });
}

// Returns a list of unmet publication requirements (empty => publishable).
async function getPublicationBlockers(listingId: number): Promise<string[]> {
  const listing = await prisma.produceListing.findUnique({
    where: { id: listingId },
    select: {
      quantity: true,
      pricePerUnit: true,
      availableDate: true,
      agentConfirmed: true,
      cropCategoryId: true,
      farmer: { select: { status: true, consentConfirmedAt: true } },
      _count: { select: { images: true } },
    },
  });
  if (!listing) throw AppError.notFound('Listing not found');

  const blockers: string[] = [];
  if (listing.farmer.status !== FarmerStatus.ACTIVE) {
    blockers.push('Farmer must be active');
  }
  if (!listing.farmer.consentConfirmedAt) {
    blockers.push('Farmer consent must be recorded');
  }
  if (!listing.cropCategoryId) {
    blockers.push('A valid crop category is required');
  }
  if (Number(listing.quantity) <= 0) {
    blockers.push('Quantity must be greater than zero');
  }
  if (Number(listing.pricePerUnit) <= 0) {
    blockers.push('Price must be greater than zero');
  }
  if (!listing.availableDate) {
    blockers.push('A valid availability date is required');
  }
  if (listing._count.images < 1) {
    blockers.push('At least one crop image is required');
  }
  if (!listing.agentConfirmed) {
    blockers.push('The field agent must confirm the listing');
  }
  return blockers;
}

export async function publishListing(actor: Actor, uuid: string) {
  const listing = await resolveOwnedListing(actor, uuid);

  if (listing.status === ListingStatus.PUBLISHED) {
    throw AppError.badRequest('Listing is already published', 'ALREADY_PUBLISHED');
  }

  const blockers = await getPublicationBlockers(listing.id);
  if (blockers.length > 0) {
    throw AppError.validation(
      { publication: blockers },
      'Listing does not meet publication requirements'
    );
  }

  const current = await prisma.produceListing.findUniqueOrThrow({
    where: { id: listing.id },
    select: { availableDate: true, quantity: true },
  });

  // Expire 14 days after availability, or 30 days from now as a fallback.
  const base = current.availableDate ?? new Date();
  const expiresAt = new Date(base.getTime() + 14 * 24 * 60 * 60 * 1000);

  return prisma.produceListing.update({
    where: { id: listing.id },
    data: {
      status: ListingStatus.PUBLISHED,
      publishedAt: new Date(),
      availableQuantity: current.quantity,
      expiresAt,
    },
    select: detailSelect,
  });
}

export async function unpublishListing(actor: Actor, uuid: string) {
  const listing = await resolveOwnedListing(actor, uuid);
  if (listing.status !== ListingStatus.PUBLISHED) {
    throw AppError.badRequest('Only published listings can be unpublished', 'NOT_PUBLISHED');
  }
  return prisma.produceListing.update({
    where: { id: listing.id },
    data: { status: ListingStatus.DRAFT, publishedAt: null },
    select: detailSelect,
  });
}
