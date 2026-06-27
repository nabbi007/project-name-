/** Spoken prompts for missing listing fields (English + Twi). */
const FIELD_PROMPTS_EN: Record<string, string> = {
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

const FIELD_PROMPTS_TW: Record<string, string> = {
  crop: 'dua a wode reto no',
  cropCategory: 'dua a wode reto no',
  quantity: 'susu a wuwɔ',
  unit: 'nkyekyɛmu a wode bo no, sɛ bag anaa kilo a',
  pricePerUnit: 'bo a ɛwɔ Ghana sidi mu basket biara anaa unit biara',
  price: 'bo a ɛwɔ Ghana sidi mu basket biara anaa unit biara',
  availableDate: 'da a aduan no bɛyɛ adan ama atɔfo',
  expiryDate: 'nna ahe a wobɛtɔ aduan no',
  expiresAt: 'nna ahe a wobɛtɔ aduan no',
  description: 'nsɛm foforo a ɛfa aduan no ho',
};

function normalizePromptLanguage(language?: string | null): 'en' | 'tw' {
  const code = (language ?? 'en').trim().toLowerCase();
  if (code === 'tw' || code === 'twi') return 'tw';
  return 'en';
}

export function buildMissingFieldsPrompt(
  fields: string[],
  farmerName?: string | null,
  language?: string | null
): string {
  const lang = normalizePromptLanguage(language);
  const prompts = lang === 'tw' ? FIELD_PROMPTS_TW : FIELD_PROMPTS_EN;
  const unique = [...new Set(fields.map((f) => (f === 'price' ? 'pricePerUnit' : f)))];
  const parts = unique.map((f) => prompts[f]).filter(Boolean);

  if (parts.length === 0) {
    return lang === 'tw'
      ? 'Mesrɛ, ka bio fa wo aduan a wode rebɛtɔ no ho.'
      : 'Please tell us more about your produce listing.';
  }

  if (lang === 'tw') {
    const greeting = farmerName ? `${farmerName}, ` : '';
    const need =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(', ')} ne ${parts[parts.length - 1]}`;
    return `${greeting}yɛsrɛ sɛ ka ${need}. Ka seisei ara.`;
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
}): string[] {
  const fields: string[] = [];
  const title = (listing.title ?? '').trim();
  const looksLikeTitle =
    title && !/^\d/.test(title) && title.split(/\s+/).length <= 4 && !/pricing/i.test(title);

  if (!looksLikeTitle) fields.push('crop');
  const qty = Number(listing.quantity);
  if (!Number.isFinite(qty) || qty <= 0) fields.push('quantity');
  if (!listing.unit) fields.push('unit');
  const price = Number(listing.pricePerUnit);
  if (!Number.isFinite(price) || price <= 0) fields.push('pricePerUnit');
  if (!listing.availableDate) fields.push('availableDate');
  return fields;
}
