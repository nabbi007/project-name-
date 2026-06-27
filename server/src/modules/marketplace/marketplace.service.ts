import { Prisma, ListingStatus, ImageStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { PaginationMeta, buildPagination } from '../../utils/apiResponse';
import { expireOldListings } from '../listings/listings.service';
import { BrowseQuery } from './marketplace.validators';

// Public listing card - deliberately EXCLUDES the farmer phone number and any
// internal/agent-only fields.
const publicListSelect = {
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
  publishedAt: true,
  cropCategory: { select: { uuid: true, name: true, slug: true } },
  farmer: {
    select: {
      uuid: true,
      fullName: true,
      displayName: true,
      region: true,
      district: true,
      community: true,
    },
  },
  images: {
    where: { status: { in: [ImageStatus.ANALYSED, ImageStatus.REVIEWED] } },
    select: { uuid: true, imagePath: true, isPrimary: true, cropMatchStatus: true },
    orderBy: { isPrimary: 'desc' as const },
  },
} satisfies Prisma.ProduceListingSelect;

const publicDetailSelect = {
  ...publicListSelect,
  visionDescription: true,
} satisfies Prisma.ProduceListingSelect;

// Only listings that are published, in stock, and not expired are visible.
function visibleWhere(): Prisma.ProduceListingWhereInput {
  return {
    status: ListingStatus.PUBLISHED,
    availableQuantity: { gt: 0 },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

export async function browseListings(
  query: BrowseQuery
): Promise<{ listings: unknown[]; pagination: PaginationMeta }> {
  await expireOldListings();

  const where: Prisma.ProduceListingWhereInput = { ...visibleWhere() };
  const and: Prisma.ProduceListingWhereInput[] = [];

  if (query.crop) {
    and.push({
      OR: [
        { title: { contains: query.crop, mode: 'insensitive' } },
        { cropCategory: { name: { contains: query.crop, mode: 'insensitive' } } },
        { cropCategory: { slug: { contains: query.crop.toLowerCase(), mode: 'insensitive' } } },
      ],
    });
  }
  if (query.region) where.region = { contains: query.region, mode: 'insensitive' };
  if (query.community) where.community = { contains: query.community, mode: 'insensitive' };
  if (query.search) {
    and.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.pricePerUnit = {
      ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
    };
  }
  if (and.length) where.AND = and;

  const orderBy: Prisma.ProduceListingOrderByWithRelationInput =
    query.sort === 'price_asc'
      ? { pricePerUnit: 'asc' }
      : query.sort === 'price_desc'
        ? { pricePerUnit: 'desc' }
        : { publishedAt: 'desc' };

  const [total, listings] = await Promise.all([
    prisma.produceListing.count({ where }),
    prisma.produceListing.findMany({
      where,
      select: publicListSelect,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { listings, pagination: buildPagination(query.page, query.limit, total) };
}

export async function getPublicListing(uuid: string) {
  await expireOldListings();
  const listing = await prisma.produceListing.findFirst({
    where: { uuid, ...visibleWhere() },
    select: publicDetailSelect,
  });
  if (!listing) throw AppError.notFound('Listing not found');
  return listing;
}

export async function getPublicFarmer(uuid: string) {
  const farmer = await prisma.farmer.findUnique({
    where: { uuid },
    select: {
      uuid: true,
      fullName: true,
      displayName: true,
      region: true,
      district: true,
      community: true,
      createdAt: true,
    },
  });
  if (!farmer) throw AppError.notFound('Farmer not found');

  const listings = await prisma.produceListing.findMany({
    where: { farmer: { uuid }, ...visibleWhere() },
    select: publicListSelect,
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  return { farmer, listings };
}
