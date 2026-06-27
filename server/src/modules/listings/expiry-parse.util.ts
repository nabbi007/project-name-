const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fourteen: 14,
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function parseCount(raw: string): number | null {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return WORD_NUMBERS[raw.toLowerCase()] ?? null;
}

function durationToDays(count: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('week')) return count * 7;
  if (u.startsWith('month')) return count * 30;
  return count;
}

/** Parse optional expiry from speech — explicit date or duration (e.g. "good for 2 weeks"). */
export function parseExpiryFromTranscript(
  text: string,
  baseDate: Date = new Date()
): string | null {
  const lower = text.toLowerCase();

  if (/(?:expir(?:e|es|y|ing)|sell until|good until|valid until|until|before)\s+tomorrow\b/i.test(text)) {
    return toIsoDate(addDays(baseDate, 1));
  }

  const explicit = text.match(
    /(?:expir(?:e|es|y|ing)|sell until|good until|valid until|until|before)\s+(?:on\s+)?(20\d{2}-\d{2}-\d{2})/i
  );
  if (explicit) return explicit[1];

  const duration =
    text.match(
      /(?:good for|lasts? for|valid for|keep for|sell(?:ing)? for|fresh for|available for)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|a|an)\s+(day|days|week|weeks|month|months)/i
    ) ??
    (/(?:expir|until|good for|lasts)/i.test(text)
      ? text.match(
          /\bfor\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|a|an)\s+(day|days|week|weeks|month|months)\b/i
        )
      : null);

  if (duration) {
    const count = parseCount(duration[1]);
    if (count) {
      return toIsoDate(addDays(baseDate, durationToDays(count, duration[2])));
    }
  }

  const looseDuration = lower.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s+(day|days|week|weeks|month|months)\b/
  );
  if (looseDuration && /(?:expir|until|good for|lasts|duration|how long)/i.test(text)) {
    const count = parseCount(looseDuration[1]);
    if (count) {
      return toIsoDate(addDays(baseDate, durationToDays(count, looseDuration[2])));
    }
  }

  const isos = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
  if (isos.length >= 2 && /(?:expir|until|and|to)\b/i.test(text)) {
    return isos[isos.length - 1];
  }

  return null;
}
