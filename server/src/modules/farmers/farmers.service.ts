import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { PaginationMeta, buildPagination } from '../../utils/apiResponse';
import {
  CreateFarmerInput,
  ListFarmersQuery,
  UpdateFarmerInput,
  UpdateFarmerStatusInput,
} from './farmers.validators';

// The authenticated actor making the request.
export interface Actor {
  id: number;
  role: UserRole;
}

const farmerSelect = {
  uuid: true,
  fullName: true,
  displayName: true,
  phone: true,
  gender: true,
  preferredLanguage: true,
  region: true,
  district: true,
  community: true,
  consentConfirmedAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  fieldAgent: {
    select: { uuid: true, name: true },
  },
} satisfies Prisma.FarmerSelect;

// Field agents are restricted to their own farmers; admins see all.
function ownershipWhere(actor: Actor): Prisma.FarmerWhereInput {
  return actor.role === UserRole.ADMIN ? {} : { fieldAgentId: actor.id };
}

export async function createFarmer(
  actor: Actor,
  input: CreateFarmerInput
) {
  return prisma.farmer.create({
    data: {
      fieldAgentId: actor.id,
      fullName: input.fullName,
      displayName: input.displayName,
      phone: input.phone,
      gender: input.gender,
      preferredLanguage: input.preferredLanguage,
      region: input.region,
      district: input.district,
      community: input.community,
      notes: input.notes,
      consentConfirmedAt: input.consentConfirmed ? new Date() : null,
    },
    select: farmerSelect,
  });
}

export async function listFarmers(
  actor: Actor,
  query: ListFarmersQuery
): Promise<{ farmers: unknown[]; pagination: PaginationMeta }> {
  const where: Prisma.FarmerWhereInput = { ...ownershipWhere(actor) };

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { displayName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { community: { contains: query.search, mode: 'insensitive' } },
      { region: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, farmers] = await Promise.all([
    prisma.farmer.count({ where }),
    prisma.farmer.findMany({
      where,
      select: farmerSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    farmers,
    pagination: buildPagination(query.page, query.limit, total),
  };
}

// Loads a farmer enforcing ownership. Returns 404 (not 403) for farmers the
// actor cannot access, so we never reveal another agent's records.
async function findOwnedFarmerId(actor: Actor, uuid: string): Promise<number> {
  const farmer = await prisma.farmer.findFirst({
    where: { uuid, ...ownershipWhere(actor) },
    select: { id: true },
  });
  if (!farmer) {
    throw AppError.notFound('Farmer not found');
  }
  return farmer.id;
}

export async function getFarmer(actor: Actor, uuid: string) {
  const farmer = await prisma.farmer.findFirst({
    where: { uuid, ...ownershipWhere(actor) },
    select: farmerSelect,
  });
  if (!farmer) {
    throw AppError.notFound('Farmer not found');
  }
  return farmer;
}

export async function updateFarmer(
  actor: Actor,
  uuid: string,
  input: UpdateFarmerInput
) {
  const id = await findOwnedFarmerId(actor, uuid);

  const data: Prisma.FarmerUpdateInput = {
    fullName: input.fullName,
    displayName: input.displayName,
    phone: input.phone,
    gender: input.gender,
    preferredLanguage: input.preferredLanguage,
    region: input.region,
    district: input.district,
    community: input.community,
    notes: input.notes,
  };

  if (input.consentConfirmed !== undefined) {
    data.consentConfirmedAt = input.consentConfirmed ? new Date() : null;
  }

  return prisma.farmer.update({
    where: { id },
    data,
    select: farmerSelect,
  });
}

export async function updateFarmerStatus(
  actor: Actor,
  uuid: string,
  input: UpdateFarmerStatusInput
) {
  const id = await findOwnedFarmerId(actor, uuid);
  return prisma.farmer.update({
    where: { id },
    data: { status: input.status },
    select: farmerSelect,
  });
}
