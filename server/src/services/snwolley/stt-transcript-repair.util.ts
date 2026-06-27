/** Fix common Snwolley STT mishearings for Ghana farmer speech. */
export function repairSttTranscript(text: string): string {
  return text
    .replace(/\b(\d+(?:\.\d+)?)\s+cit(y|ies)\b/gi, '$1 cedis')
    .replace(/\bgh\s+cit(y|ies)\b/gi, 'gh cedis')
    .replace(/\bghana\s+cit(y|ies)\b/gi, 'ghana cedis')
    .replace(/\bsidi(s)?\b/gi, 'cedis')
    .replace(/\bsedis\b/gi, 'cedis')
    .replace(/\bsidi\b/gi, 'cedis')
    .replace(/\bsee\s+diss?\b/gi, 'cedis')
    .replace(/\bGH₵\s*/g, 'GH₵ ')
    .replace(/\s+/g, ' ')
    .trim();
}
