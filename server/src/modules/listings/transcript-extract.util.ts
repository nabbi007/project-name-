import { normaliseUnit, type SupportedUnit } from './listing.constants';
import { parseExpiryFromTranscript } from './expiry-parse.util';

export interface LocalExtractedListing {
  crop: string | null;
  quantity: number | null;
  unit: string | null;
  pricePerUnit: number | null;
  availableDate: string | null;
  expiryDate: string | null;
  description: string | null;
}

const UNIT_WORDS =
  /\b(\d+(?:\.\d+)?)\s*(kg|kilos?|bags?|sacks?|baskets?|crates?|boxes?|bunches?|bundles?|pieces?|tubers?|bowls?|olonkas?)\b/i;

const SINGLE_UNIT =
  /\b(?:a|an|one|\d+)\s+(kg|kilo|kilos|bag|bags|sack|sacks|basket|baskets|crate|crates|box|boxes|bunch|bunches|bundle|bundles|piece|pieces|tuber|tubers|bowl|bowls|olonka|olonkas)\b/i;

const COMMON_CROPS =
  /\b(maize|corn|tomato(?:es)?|cassava|yam|yams|plantain|plantains|pepper|peppers|rice|bean|beans|groundnut|groundnuts|cowpea|onion|onions|garlic|ginger|cocoa|coffee|orange|oranges|mango|mangoes|banana|bananas|okra|cabbage|lettuce|carrot|carrots)\b/i;

function unitFromWord(word: string): SupportedUnit | null {
  const w = word.toLowerCase().replace(/s$/, '');
  const map: Record<string, SupportedUnit> = {
    kg: 'KG',
    kilo: 'KG',
    bag: 'BAG',
    sack: 'SACK',
    basket: 'BASKET',
    crate: 'CRATE',
    box: 'BOX',
    bunch: 'BUNCH',
    bundle: 'BUNDLE',
    piece: 'PIECE',
    tuber: 'TUBER',
    bowl: 'BOWL',
    olonka: 'OLONKA',
  };
  const unit = map[w];
  return unit ?? normaliseUnit(word);
}

function stripQuestionPrefixes(block: string): string {
  return block
    .replace(/^[A-Z_]+:\s*/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function incompleteFieldsFor(extracted: LocalExtractedListing): string[] {
  const fields: string[] = [];
  if (!extracted.crop) fields.push('crop');
  if (extracted.quantity === null || extracted.quantity <= 0) fields.push('quantity');
  if (!extracted.unit) fields.push('unit');
  if (extracted.pricePerUnit === null || extracted.pricePerUnit <= 0) fields.push('pricePerUnit');
  if (!extracted.availableDate) fields.push('availableDate');
  if (!extracted.description) fields.push('description');
  return fields;
}

/** Rule-based parse when Snwolley Agents API is unavailable. */
export function extractFromTranscriptLocally(transcriptBlock: string): {
  extracted: LocalExtractedListing;
  incompleteFields: string[];
} {
  const text = stripQuestionPrefixes(transcriptBlock);

  let quantity: number | null = null;
  let unit: SupportedUnit | null = null;
  let crop: string | null = null;

  const qtyUnitCrop = text.match(
    /\b(\d+(?:\.\d+)?)\s*(kg|kilos?|bags?|sacks?|baskets?|crates?|boxes?|bunches?|bundles?|pieces?|tubers?|bowls?|olonkas?)\s+(?:of\s+)?([a-zA-Z]+)/i
  );
  if (qtyUnitCrop) {
    quantity = Number(qtyUnitCrop[1]);
    unit = unitFromWord(qtyUnitCrop[2]);
    crop = qtyUnitCrop[3].charAt(0).toUpperCase() + qtyUnitCrop[3].slice(1).toLowerCase();
  }

  const qtyMatch = text.match(UNIT_WORDS);
  if (qtyMatch) {
    quantity = Number(qtyMatch[1]);
    unit = unitFromWord(qtyMatch[2]);
  } else if (!quantity) {
    const single = text.match(SINGLE_UNIT);
    if (single) {
      quantity = 1;
      unit = unitFromWord(single[1]);
    }
  }

  if (!quantity) {
    const twiCount = text.match(/\bahodo\s+(\d+(?:\.\d+)?)\b/i);
    if (twiCount) quantity = Number(twiCount[1]);
  }

  if (!quantity) {
    const typedCount = text.match(/\b(\d+(?:\.\d+)?)\s*(?:varieties|types|kinds|pieces|units)\b/i);
    if (typedCount) quantity = Number(typedCount[1]);
  }

  if (!quantity) {
    const cropCount = text.match(
      /\b(?:tomato(?:es)?|maize|yam|yams|pepper(?:s)?|cassava|plantain(?:s)?|onion(?:s)?)[^,.]{0,40}?\b(\d+(?:\.\d+)?)\b/i
    );
    if (cropCount) quantity = Number(cropCount[1]);
  }

  if (!unit) {
    const unitMention = text.match(
      /\b(basket|baskets|bag|bags|sack|sacks|crate|crates|box|boxes|kilo|kilos|kg)\b/i
    );
    if (unitMention) unit = unitFromWord(unitMention[1]);
  }

  let pricePerUnit: number | null = null;
  const priceMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:cedis|ghs|₵)/i) ??
    text.match(/(?:₵|ghs|GH₵)\s*(\d+(?:\.\d+)?)/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*(?:per|each|biara)\s*(?:basket|bag|sack|crate|box|kilo|kg|unit)/i) ??
    text.match(/(?:price|costs?|at|for|biara|bo)\s*(?:is\s*)?(?:₵|ghs|GH₵)?\s*(\d+(?:\.\d+)?)/i);
  if (priceMatch) {
    pricePerUnit = Number(priceMatch[1]);
  } else if (/price|cedis|₵|ghs|sidi|biara/i.test(text)) {
    const lone = text.match(/\b(\d{2,4}(?:\.\d+)?)\b/);
    if (lone) pricePerUnit = Number(lone[1]);
  }

  if (!crop) {
    const ofMatch = text.match(
      /\bof\s+([a-zA-Z][a-zA-Z\s-]{1,24}?)(?:\s+(?:at|for|costs?|is|was|,|\.|\d)|$)/i
    );
    if (ofMatch) {
      crop = ofMatch[1].trim();
    } else {
      const cropMatch = text.match(COMMON_CROPS);
      if (cropMatch) {
        crop = cropMatch[1].charAt(0).toUpperCase() + cropMatch[1].slice(1).toLowerCase();
      }
    }
  }

  let availableDate: string | null = null;
  const addDays = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  if (/\btomorrow\b/i.test(text) && !/expir/i.test(text)) {
    availableDate = addDays(1);
  } else if (/\b(today|now)\b/i.test(text) && !/expir/i.test(text)) {
    availableDate = addDays(0);
  } else if (/\b(?:ready\s+)?next\s+week\b/i.test(text) && !/expir/i.test(text)) {
    availableDate = addDays(7);
  } else if (/\b(?:ready\s+)?next\s+month\b/i.test(text) && !/expir/i.test(text)) {
    availableDate = addDays(30);
  } else {
    const readyIn = text.match(
      /\b(?:ready|available)\s+(?:in|on|from)?\s*(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(day|days|week|weeks|month|months)\b/i
    );
    if (readyIn) {
      const wordToNum: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      };
      const raw = readyIn[1]?.toLowerCase();
      const count = raw ? (wordToNum[raw] ?? Number(raw)) || 1 : 1;
      const days = readyIn[2].toLowerCase().startsWith('week')
        ? count * 7
        : readyIn[2].toLowerCase().startsWith('month')
          ? count * 30
          : count;
      availableDate = addDays(days);
    } else {
      const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      if (iso) availableDate = iso[1];
    }
  }

  const expiryBase = availableDate ? new Date(availableDate) : new Date();
  const expiryDate = parseExpiryFromTranscript(text, expiryBase);

  const description = text || null;

  const extracted: LocalExtractedListing = {
    crop,
    quantity,
    unit,
    pricePerUnit,
    availableDate,
    expiryDate,
    description,
  };

  return { extracted, incompleteFields: incompleteFieldsFor(extracted) };
}
