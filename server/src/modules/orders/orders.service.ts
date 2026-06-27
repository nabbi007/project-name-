import crypto from 'crypto';
import {
  Prisma,
  UserRole,
  OrderStatus,
  PaymentStatus,
  ListingStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { PaginationMeta, buildPagination } from '../../utils/apiResponse';
import {
  CreateOrderInput,
  ListOrdersQuery,
  UpdateStatusInput,
} from './orders.validators';

export interface Actor {
  id: number;
  role: UserRole;
}

// Allowed agent/admin-driven status transitions.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [
    OrderStatus.AWAITING_COLLECTION,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.IN_TRANSIT,
    OrderStatus.CANCELLED,
  ],
  AWAITING_COLLECTION: [OrderStatus.COLLECTED, OrderStatus.CANCELLED],
  READY_FOR_PICKUP: [OrderStatus.COLLECTED, OrderStatus.CANCELLED],
  IN_TRANSIT: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  COLLECTED: [OrderStatus.COMPLETED, OrderStatus.DISPUTED],
  DELIVERED: [OrderStatus.COMPLETED, OrderStatus.DISPUTED],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
};

// Buyers may cancel only before the produce changes hands.
const BUYER_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

const orderSelect = {
  uuid: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  deliveryMethod: true,
  deliveryLocation: true,
  subtotal: true,
  deliveryFee: true,
  totalAmount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  buyer: { select: { uuid: true, name: true, phone: true } },
  items: {
    select: {
      uuid: true,
      quantity: true,
      unitPrice: true,
      subtotal: true,
      produceListing: {
        select: {
          uuid: true,
          title: true,
          unit: true,
          pricePerUnit: true,
          cropCategory: { select: { name: true, slug: true } },
          farmer: {
            select: { uuid: true, fullName: true, displayName: true, region: true, community: true },
          },
          images: {
            select: { uuid: true, imagePath: true, isPrimary: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  },
  statusHistory: {
    select: { previousStatus: true, newStatus: true, notes: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.OrderSelect;

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `AGV-${stamp}-${rand}`;
}

function paymentStatusFor(method: string): PaymentStatus {
  switch (method) {
    case 'SIMULATED_MOMO':
      return PaymentStatus.SIMULATED_PAID;
    case 'CASH_ON_DELIVERY':
      return PaymentStatus.CASH_ON_DELIVERY;
    case 'PAY_ON_PICKUP':
      return PaymentStatus.PAY_ON_PICKUP;
    default:
      return PaymentStatus.PENDING;
  }
}

// Neon can have high round-trip latency; give interactive transactions headroom.
const TX_OPTIONS = { maxWait: 10000, timeout: 20000 } as const;

export async function createOrder(actor: Actor, input: CreateOrderInput) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.produceListing.findFirst({
      where: {
        uuid: input.listingId,
        status: ListingStatus.PUBLISHED,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        farmerId: true,
        pricePerUnit: true,
        availableQuantity: true,
      },
    });
    if (!listing) {
      throw AppError.badRequest('Listing is not available for ordering', 'LISTING_UNAVAILABLE');
    }

    const available = Number(listing.availableQuantity);
    if (input.quantity > available) {
      throw AppError.badRequest(
        `Only ${available} unit(s) are available`,
        'INSUFFICIENT_STOCK'
      );
    }

    const remaining = available - input.quantity;
    await tx.produceListing.update({
      where: { id: listing.id },
      data: {
        availableQuantity: remaining,
        ...(remaining <= 0 ? { status: ListingStatus.SOLD_OUT } : {}),
      },
    });

    const unitPrice = Number(listing.pricePerUnit);
    const subtotal = unitPrice * input.quantity;

    return tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        buyerId: actor.id,
        subtotal,
        deliveryFee: 0,
        totalAmount: subtotal,
        deliveryMethod: input.deliveryMethod,
        deliveryLocation: input.deliveryLocation,
        paymentMethod: input.paymentMethod,
        paymentStatus: paymentStatusFor(input.paymentMethod),
        status: OrderStatus.PENDING,
        notes: input.notes,
        items: {
          create: {
            produceListingId: listing.id,
            farmerId: listing.farmerId,
            quantity: input.quantity,
            unitPrice,
            subtotal,
          },
        },
        statusHistory: {
          create: { newStatus: OrderStatus.PENDING, changedById: actor.id },
        },
      },
      select: orderSelect,
    });
  }, TX_OPTIONS);
}

export async function listMyOrders(
  actor: Actor,
  query: ListOrdersQuery
): Promise<{ orders: unknown[]; pagination: PaginationMeta }> {
  const where: Prisma.OrderWhereInput = { buyerId: actor.id };
  if (query.status) where.status = query.status;
  return paginate(where, query);
}

export async function listManagedOrders(
  actor: Actor,
  query: ListOrdersQuery
): Promise<{ orders: unknown[]; pagination: PaginationMeta }> {
  const where: Prisma.OrderWhereInput =
    actor.role === UserRole.ADMIN
      ? {}
      : { items: { some: { produceListing: { fieldAgentId: actor.id } } } };
  if (query.status) where.status = query.status;
  return paginate(where, query);
}

async function paginate(where: Prisma.OrderWhereInput, query: ListOrdersQuery) {
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return { orders, pagination: buildPagination(query.page, query.limit, total) };
}

// Access: buyer sees own; agent sees orders for their listings; admin sees all.
export async function getOrder(actor: Actor, uuid: string) {
  const where: Prisma.OrderWhereInput = { uuid };
  if (actor.role === UserRole.BUYER) {
    where.buyerId = actor.id;
  } else if (actor.role === UserRole.FIELD_AGENT) {
    where.items = { some: { produceListing: { fieldAgentId: actor.id } } };
  }
  const order = await prisma.order.findFirst({ where, select: orderSelect });
  if (!order) throw AppError.notFound('Order not found');
  return order;
}

// Restores reserved stock and re-publishes any sold-out listings.
async function restoreStock(
  tx: Prisma.TransactionClient,
  items: { produceListingId: number; quantity: Prisma.Decimal }[]
): Promise<void> {
  for (const item of items) {
    const listing = await tx.produceListing.update({
      where: { id: item.produceListingId },
      data: { availableQuantity: { increment: item.quantity } },
      select: { availableQuantity: true, status: true, expiresAt: true },
    });
    const notExpired = !listing.expiresAt || listing.expiresAt > new Date();
    if (
      listing.status === ListingStatus.SOLD_OUT &&
      Number(listing.availableQuantity) > 0 &&
      notExpired
    ) {
      await tx.produceListing.update({
        where: { id: item.produceListingId },
        data: { status: ListingStatus.PUBLISHED },
      });
    }
  }
}

export async function cancelOrder(actor: Actor, uuid: string) {
  const order = await prisma.order.findFirst({
    where: { uuid, buyerId: actor.id },
    select: { id: true, status: true, items: { select: { produceListingId: true, quantity: true } } },
  });
  if (!order) throw AppError.notFound('Order not found');
  if (!BUYER_CANCELLABLE.includes(order.status)) {
    throw AppError.badRequest(
      `An order with status ${order.status} can no longer be cancelled`,
      'ORDER_NOT_CANCELLABLE'
    );
  }

  return prisma.$transaction(async (tx) => {
    await restoreStock(tx, order.items);
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: OrderStatus.CANCELLED,
        changedById: actor.id,
        notes: 'Cancelled by buyer',
      },
    });
    return tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
      select: orderSelect,
    });
  }, TX_OPTIONS);
}

export async function updateStatus(
  actor: Actor,
  uuid: string,
  input: UpdateStatusInput
) {
  const where: Prisma.OrderWhereInput = { uuid };
  if (actor.role === UserRole.FIELD_AGENT) {
    where.items = { some: { produceListing: { fieldAgentId: actor.id } } };
  }
  const order = await prisma.order.findFirst({
    where,
    select: { id: true, status: true, items: { select: { produceListingId: true, quantity: true } } },
  });
  if (!order) throw AppError.notFound('Order not found');

  const allowed = TRANSITIONS[order.status];
  if (!allowed.includes(input.status)) {
    throw AppError.badRequest(
      `Cannot change status from ${order.status} to ${input.status}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  return prisma.$transaction(async (tx) => {
    if (input.status === OrderStatus.CANCELLED) {
      await restoreStock(tx, order.items);
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: input.status,
        changedById: actor.id,
        notes: input.notes,
      },
    });
    return tx.order.update({
      where: { id: order.id },
      data: { status: input.status },
      select: orderSelect,
    });
  }, TX_OPTIONS);
}

// Field agent records that the farmer acknowledged the order (PENDING → CONFIRMED).
export async function confirmFarmerOrder(actor: Actor, uuid: string) {
  if (actor.role === UserRole.BUYER) {
    throw AppError.forbidden('Only field agents can confirm on behalf of farmers');
  }

  const where: Prisma.OrderWhereInput = { uuid };
  if (actor.role === UserRole.FIELD_AGENT) {
    where.items = { some: { produceListing: { fieldAgentId: actor.id } } };
  }

  const order = await prisma.order.findFirst({
    where,
    select: { id: true, status: true },
  });
  if (!order) throw AppError.notFound('Order not found');

  if (order.status === OrderStatus.CONFIRMED) {
    return getOrder(actor, uuid);
  }
  if (order.status !== OrderStatus.PENDING) {
    throw AppError.badRequest(
      `Order with status ${order.status} cannot be farmer-confirmed`,
      'ORDER_NOT_CONFIRMABLE'
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: OrderStatus.CONFIRMED,
        changedById: actor.id,
        notes: 'Farmer confirmed via field agent',
      },
    });
    return tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CONFIRMED },
      select: orderSelect,
    });
  }, TX_OPTIONS);
}
