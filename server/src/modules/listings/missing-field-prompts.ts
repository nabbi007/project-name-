/** Spoken prompts (English — Snwolley hackathon TTS) for missing listing fields. */
const FIELD_PROMPTS: Record<string, string> = {
  crop: 'what crop you are selling',
  cropCategory: 'what crop you are selling',
  quantity: 'how much you have',
  unit: 'what unit it is measured in, for example bags or kilograms',
  pricePerUnit: 'the price per unit in Ghana cedis',
  price: 'the price per unit in Ghana cedis',
  availableDate: 'when the produce will be ready for buyers',
  expiryDate: 'how long the listing stays for sale, or an expiry date',
  expiresAt: 'how long the listing stays for sale, or an expiry date',
  description: 'any other details about your produce',
};

export function buildMissingFieldsPrompt(
  fields: string[],
  farmerName?: string | null
): string {
  const unique = [...new Set(fields.map((f) => (f === 'price' ? 'pricePerUnit' : f)))];
  const parts = unique
    .map((f) => FIELD_PROMPTS[f])
    .filter(Boolean);

  if (parts.length === 0) {
    return 'Please tell us more about your produce listing.';
  }

  const greeting = farmerName ? `Hello ${farmerName}. ` : '';
  const need =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return `${greeting}We still need ${need}. Please say it now.`;
}

const PUBLISH_VOICE_FIELDS = new Set([
  'crop',
  'quantity',
  'unit',
  'pricePerUnit',
  'availableDate',
]);

/** Fields that block publication and can be collected by voice follow-up. */
export function filterVoicePromptFields(fields: string[]): string[] {
  return [...new Set(fields.map((f) => (f === 'price' ? 'pricePerUnit' : f)))].filter((f) =>
    PUBLISH_VOICE_FIELDS.has(f)
  );
}

export function listingIncompleteFields(listing: {
  title?: string | null;
  quantity?: unknown;
  unit?: string | null;
  pricePerUnit?: unknown;
  availableDate?: Date | null;
  cropCategoryId?: number | null;
  cropCategory?: { uuid?: string } | null;
}): string[] {
  const fields: string[] = [];
  const title = (listing.title ?? '').trim();
  const looksLikeTitle =
    title && !/^\d/.test(title) && title.split(/\s+/).length <= 4 && !/pricing/i.test(title);
  const hasCategory = Boolean(listing.cropCategoryId ?? listing.cropCategory?.uuid);

  if (!hasCategory && !looksLikeTitle) fields.push('crop');
  const qty = Number(listing.quantity);
  if (!Number.isFinite(qty) || qty <= 0) fields.push('quantity');
  if (!listing.unit) fields.push('unit');
  const price = Number(listing.pricePerUnit);
  if (!Number.isFinite(price) || price <= 0) fields.push('pricePerUnit');
  if (!listing.availableDate) fields.push('availableDate');
  return fields;
}
