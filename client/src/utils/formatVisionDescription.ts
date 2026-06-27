export interface VisionDescriptionSection {
  title: string;
  lead?: string;
  bullets: string[];
  body?: string;
}

export interface ParsedVisionDescription {
  intro?: string;
  sections: VisionDescriptionSection[];
  /** Plain text with asterisks removed — used when no sections are detected. */
  plain: string;
}

const SECTION_HEADING =
  /(?:^|\.\s+|\s)(Crop Identification|Dominant Colors|Maturity or Ripeness|Overall Visible Condition|Visible Issues|Quality Assessment|Condition Notes):\s*/gi;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitBullets(content: string): { lead?: string; bullets: string[]; body?: string } {
  const trimmed = content.trim();
  if (!trimmed) return { bullets: [] };

  const parts = trimmed.split(/\s-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return { body: trimmed, bullets: [] };
  }

  const lead = parts[0].replace(/\.\s*$/, '').trim();
  const bullets = parts.slice(1).map((p) => p.replace(/\.\s*$/, '').trim());

  if (/[:?]$/.test(lead) || /(?:are|include|signs of)$/i.test(lead)) {
    return { lead, bullets };
  }

  return { bullets: parts.map((p) => p.replace(/\.\s*$/, '').trim()) };
}

function normalizeSectionTitle(raw: string): string {
  return raw
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Turn raw vision API markdown into structured sections for display. */
export function parseVisionDescription(raw: string): ParsedVisionDescription {
  const plain = stripMarkdown(raw);
  if (!plain) {
    return { sections: [], plain: '' };
  }

  const markers: { title: string; index: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(SECTION_HEADING.source, 'gi');

  while ((match = regex.exec(plain)) !== null) {
    const title = match[1];
    const titleStart = match.index + match[0].indexOf(title);
    markers.push({
      title,
      index: titleStart,
      end: match.index + match[0].length,
    });
  }

  if (markers.length === 0) {
    return { sections: [], plain };
  }

  const intro = plain.slice(0, markers[0].index).trim().replace(/\.\s*$/, '');
  const sections: VisionDescriptionSection[] = markers.map((marker, i) => {
    const nextStart = i + 1 < markers.length ? markers[i + 1].index : plain.length;
    const content = plain.slice(marker.end, nextStart).trim();
    const { lead, bullets, body } = splitBullets(content);

    return {
      title: normalizeSectionTitle(marker.title),
      lead,
      bullets,
      body: body && !lead ? body : undefined,
    };
  });

  return {
    intro: intro || undefined,
    sections,
    plain,
  };
}
