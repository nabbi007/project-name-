import { isEnglishLanguage, translateToEnglish } from './translate.service';
import { repairSttTranscript } from './stt-transcript-repair.util';

export interface LocalizedTranscript {
  /** Raw STT output (local language or English). */
  transcript: string;
  /** English translation when auto-translated; null otherwise. */
  correctedTranscript: string | null;
  translated: boolean;
}

/** English text used for listing extraction and agent review. */
export function displayTranscript(fields: LocalizedTranscript): string {
  return (fields.correctedTranscript ?? fields.transcript).trim();
}

/** Map STT output to stored transcript fields (local + optional English). */
export async function localizeTranscript(
  sttText: string,
  language?: string | null
): Promise<LocalizedTranscript> {
  const transcript = repairSttTranscript(sttText.trim());
  if (!transcript) {
    return { transcript: '', correctedTranscript: null, translated: false };
  }

  const { english, translated } = await translateToEnglish(transcript, language);
  if (translated && english) {
    return {
      transcript,
      correctedTranscript: repairSttTranscript(english),
      translated: true,
    };
  }

  // Local language STT with no agent translation — still normalize mishearings in place.
  if (!isEnglishLanguage(language)) {
    const normalized = repairSttTranscript(transcript);
    return { transcript: normalized, correctedTranscript: null, translated: false };
  }

  return { transcript, correctedTranscript: null, translated: false };
}
