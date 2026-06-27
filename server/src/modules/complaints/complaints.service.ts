import { ComplaintStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { PaginationMeta, buildPagination } from '../../utils/apiResponse';
import {
  CreateComplaintInput,
  ListComplaintsQuery,
  UpdateComplaintInput,
} from './complaints.validators';

export interface Actor {
  id: number;
  role: UserRole;
}

const complaintSelect = {
  uuid: true,
  category: true,
  description: true,
  status: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      uuid: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
    },
  },
  buyer: { select: { uuid: true, name: true } },
} satisfies Prisma.ComplaintSelect;

export async function createComplaint(actor: Actor, input: CreateComplaintInput) {
  if (actor.role !== UserRole.BUYER) {
    throw AppError.forbidden('Only buyers can file complaints');
  }

  const description = (input.description ?? input.message)!.trim();

  const order = await prisma.order.findFirst({
    where: { uuid: input.orderId, buyerId: actor.id },
    select: { id: true },
  });
  if (!order) {
    throw AppError.notFound('Order not found');
  }

  const existing = await prisma.complaint.findFirst({
    where: { orderId: order.id, buyerId: actor.id, status: { in: ['OPEN', 'IN_REVIEW'] } },
    select: { uuid: true },
  });
  if (existing) {
    throw AppError.badRequest(
      'An open complaint already exists for this order',
      'COMPLAINT_EXISTS'
    );
  }

  return prisma.complaint.create({
    data: {
      orderId: order.id,
      buyerId: actor.id,
      category: input.category,
      description,
    },
    select: complaintSelect,
  });
}

export async function listComplaints(
  query: ListComplaintsQuery
): Promise<{ complaints: unknown[]; pagination: PaginationMeta }> {
  const where: Prisma.ComplaintWhereInput = {};
  if (query.status) where.status = query.status;

  const [total, complaints] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      select: complaintSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { complaints, pagination: buildPagination(query.page, query.limit, total) };
}

export async function updateComplaint(
  actorId: number,
  complaintUuid: string,
  input: UpdateComplaintInput
) {
  const complaint = await prisma.complaint.findUnique({
    where: { uuid: complaintUuid },
    select: { id: true, status: true },
  });
  if (!complaint) {
    throw AppError.notFound('Complaint not found');
  }

  if (input.status === 'RESOLVED' && !input.resolution?.trim()) {
    throw AppError.badRequest(
      'A resolution is required when resolving a complaint',
      'RESOLUTION_REQUIRED'
    );
  }

  const isTerminal = input.status === 'RESOLVED' || input.status === 'REJECTED';

  return prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      status: input.status,
      resolution: input.resolution ?? undefined,
      resolvedById: isTerminal ? actorId : undefined,
      resolvedAt: isTerminal ? new Date() : undefined,
    },
    select: complaintSelect,
  });
}
