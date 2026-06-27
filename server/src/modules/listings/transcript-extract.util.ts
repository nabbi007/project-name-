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

  let pricePerUnit: number | null = null;
  const priceMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:cedis|ghs|₵)/i) ??
    text.match(/(?:price|costs?|at|for)\s*(?:is\s*)?(?:₵|ghs)?\s*(\d+(?:\.\d+)?)/i);
  if (priceMatch) {
    pricePerUnit = Number(priceMatch[1]);
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
  if (/\btomorrow\b/i.test(text) && !/expir/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    availableDate = d.toISOString().slice(0, 10);
  } else if (/\b(today|now)\b/i.test(text) && !/expir/i.test(text)) {
    availableDate = new Date().toISOString().slice(0, 10);
  } else {
    const readyIn = text.match(
      /\b(?:ready|available)\s+(?:in|on|from)\s+(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(day|days|week|weeks|month|months)\b/i
    );
    if (readyIn) {
      const count = Number(readyIn[1]) || 1;
      const days = readyIn[2].toLowerCase().startsWith('week')
        ? count * 7
        : readyIn[2].toLowerCase().startsWith('month')
          ? count * 30
          : count;
      const d = new Date();
      d.setDate(d.getDate() + days);
      availableDate = d.toISOString().slice(0, 10);
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
