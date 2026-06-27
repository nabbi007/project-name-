import { AudioMessageType } from '@prisma/client';

export interface MessageContext {
  farmerName: string;
  crop?: string | null;
  quantity?: number | null;
  unit?: string | null;
  pricePerUnit?: number | null;
  orderNumber?: string | null;
  buyerName?: string | null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

// Builds a plain-text spoken notification. Currently English; the `language`
// argument is accepted for future localisation and falls back to English.
export function buildMessage(
  type: AudioMessageType,
  ctx: MessageContext,
  _language = 'en'
): string {
  const name = firstName(ctx.farmerName);
  const crop = ctx.crop ?? 'your produce';
  const qty = ctx.quantity != null ? `${ctx.quantity} ` : '';
  const unit = ctx.unit ? `${ctx.unit.toLowerCase()} ` : '';

  switch (type) {
    case AudioMessageType.LISTING_PUBLISHED: {
      const price =
        ctx.pricePerUnit != null ? ` at ${ctx.pricePerUnit} cedis each` : '';
      return `Hello ${name}. Your listing for ${qty}${unit}${crop}${price} is now live on the AgroVoice marketplace. Buyers can now see it.`;
    }
    case AudioMessageType.NEW_ORDER: {
      const order = ctx.orderNumber ? ` Order number ${ctx.orderNumber}.` : '';
      return `Good news ${name}. You have a new order for ${qty}${unit}${crop}.${order} Please get the produce ready.`;
    }
    case AudioMessageType.ORDER_CANCELLED: {
      const order = ctx.orderNumber ? ` Order number ${ctx.orderNumber}` : 'An order';
      return `Hello ${name}.${order} for ${crop} has been cancelled. The quantity is available again for other buyers.`;
    }
    default:
      return `Hello ${name}. You have a new notification from AgroVoice.`;
  }
}
