import { Prisma, ListingStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { PaginationMeta, buildPagination } from '../../utils/apiResponse';
import {
  ListAiRunsQuery,
  ListUsersQuery,
  ModerateListingInput,
  UpdateUserStatusInput,
} from './admin.validators';

function countByKey<T extends string>(
  rows: { _count: number }[] & Array<Record<string, unknown>>,
  key: string
): Record<T, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[String(row[key])] = (row as { _count: number })._count;
  }
  return out as Record<T, number>;
}

export async function getDashboardStats() {
  const [
    usersByRole,
    farmersByStatus,
    listingsByStatus,
    ordersByStatus,
    aiByStatus,
    revenue,
    totals,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: true }),
    prisma.farmer.groupBy({ by: ['status'], _count: true }),
    prisma.produceListing.groupBy({ by: ['status'], _count: true }),
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.aiProcessingRun.groupBy({ by: ['processingStatus'], _count: true }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: 'COMPLETED' } }),
    Promise.all([
      prisma.user.count(),
      prisma.farmer.count(),
      prisma.produceListing.count(),
      prisma.order.count(),
      prisma.aiProcessingRun.count(),
    ]),
  ]);

  const [userCount, farmerCount, listingCount, orderCount, aiCount] = totals;

  return {
    users: { total: userCount, byRole: countByKey(usersByRole as any, 'role') },
    farmers: { total: farmerCount, byStatus: countByKey(farmersByStatus as any, 'status') },
    listings: { total: listingCount, byStatus: countByKey(listingsByStatus as any, 'status') },
    orders: {
      total: orderCount,
      byStatus: countByKey(ordersByStatus as any, 'status'),
      completedRevenue: Number(revenue._sum.totalAmount ?? 0),
    },
    ai: { total: aiCount, byStatus: countByKey(aiByStatus as any, 'processingStatus') },
  };
}

const publicUserSelect = {
  uuid: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listUsers(
  query: ListUsersQuery
): Promise<{ users: unknown[]; pagination: PaginationMeta }> {
  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return { users, pagination: buildPagination(query.page, query.limit, total) };
}

export async function updateUserStatus(
  actorId: number,
  userUuid: string,
  input: UpdateUserStatusInput
) {
  const user = await prisma.user.findUnique({
    where: { uuid: userUuid },
    select: { id: true },
  });
  if (!user) throw AppError.notFound('User not found');
  if (user.id === actorId) {
    throw AppError.badRequest('You cannot change your own account status', 'SELF_STATUS_CHANGE');
  }

  return prisma.user.update({
    where: { id: user.id },
    data: { status: input.status },
    select: publicUserSelect,
  });
}

export async function listAiRuns(
  query: ListAiRunsQuery
): Promise<{ runs: unknown[]; pagination: PaginationMeta }> {
  const where: Prisma.AiProcessingRunWhereInput = {};
  if (query.apiType) where.apiType = query.apiType;
  if (query.processingStatus) where.processingStatus = query.processingStatus;

  const [total, runs] = await Promise.all([
    prisma.aiProcessingRun.count({ where }),
    prisma.aiProcessingRun.findMany({
      where,
      select: {
        uuid: true,
        apiType: true,
        processableType: true,
        processableId: true,
        processingStatus: true,
        httpStatus: true,
        attempts: true,
        requestSummary: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return { runs, pagination: buildPagination(query.page, query.limit, total) };
}

export async function moderateListing(uuid: string, input: ModerateListingInput) {
  const listing = await prisma.produceListing.findUnique({
    where: { uuid },
    select: { id: true, status: true, quantity: true, availableQuantity: true, availableDate: true },
  });
  if (!listing) throw AppError.notFound('Listing not found');

  const detailSelect = {
    uuid: true,
    title: true,
    status: true,
    publishedAt: true,
    availableQuantity: true,
    expiresAt: true,
  } satisfies Prisma.ProduceListingSelect;

  if (input.decision === 'REJECT') {
    return prisma.produceListing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.REJECTED, publishedAt: null },
      select: detailSelect,
    });
  }

  // APPROVE -> publish (admin override). Ensure sane stock + expiry.
  const base = listing.availableDate ?? new Date();
  const expiresAt = new Date(base.getTime() + 14 * 24 * 60 * 60 * 1000);
  const available =
    Number(listing.availableQuantity) > 0 ? listing.availableQuantity : listing.quantity;

  return prisma.produceListing.update({
    where: { id: listing.id },
    data: {
      status: ListingStatus.PUBLISHED,
      publishedAt: new Date(),
      availableQuantity: available,
      expiresAt,
    },
    select: detailSelect,
  });
}
