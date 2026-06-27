import React, { useCallback, useEffect, useRef, useState } from 'react';
import { listingsApi, type GeneratedAudio, type Listing } from '../../api/listings.api';
import { AudioRecorder } from './AudioRecorder';
import { Button, ErrorAlert, Spinner, SuccessAlert } from '../shared';

const FIELD_LABELS: Record<string, string> = {
  crop: 'crop name',
  quantity: 'quantity',
  unit: 'unit',
  pricePerUnit: 'price per unit',
  availableDate: 'Availability date',
  expiryDate: 'Expiry / duration',
};

interface MissingFieldsVoicePromptProps {
  listingId: string;
  fields: string[];
  farmerName?: string;
  language?: string;
  onUpdated: (listing: Listing, remainingFields: string[]) => void;
}

export const MissingFieldsVoicePrompt: React.FC<MissingFieldsVoicePromptProps> = ({
  listingId,
  fields,
  farmerName,
  language,
  onUpdated,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [promptAudio, setPromptAudio] = useState<GeneratedAudio | null>(null);
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [supplementError, setSupplementError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastOriginalTranscript, setLastOriginalTranscript] = useState<string | null>(null);

  const fieldLabels = fields.map((f) => FIELD_LABELS[f] ?? f.replace(/([A-Z])/g, ' $1').toLowerCase());

  const loadPrompt = useCallback(async () => {
    setPromptLoading(true);
    setPromptError(null);
    setPromptAudio(null);
    try {
      const audio = await listingsApi.generateMissingFieldsAudio(listingId, fields, language);
      setPromptAudio(audio);
    } catch {
      setPromptError('Could not generate the spoken prompt. You can still record below.');
    } finally {
      setPromptLoading(false);
    }
  }, [listingId, fields, language]);

  useEffect(() => {
    void loadPrompt();
  }, [loadPrompt]);

  useEffect(() => {
    if (!promptAudio?.audioUrl || !audioRef.current) return;
    audioRef.current.load();
    void audioRef.current.play().catch(() => {
      // Autoplay may be blocked until user taps play.
    });
  }, [promptAudio?.audioUrl]);

  const handleRecordingComplete = async (blob: Blob) => {
    setRecording(false);
    setProcessing(true);
    setSupplementError(null);
    setLastTranscript(null);
    setLastOriginalTranscript(null);
    try {
      const result = await listingsApi.supplementListingVoice(listingId, blob, language);
      setLastTranscript(result.transcript);
      setLastOriginalTranscript(result.originalTranscript ?? null);
      onUpdated(result.listing, result.incompleteFields);
    } catch {
      setSupplementError('Could not read that recording. Try again or fill in the form below.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="card p-6 space-y-4 border-2 border-amber-200 bg-amber-50/50">
      <div>
        <h2 className="text-lg font-semibold text-amber-900">We need a bit more from the farmer</h2>
        <p className="text-sm text-amber-800 mt-1">
          Still missing: {fieldLabels.join(', ')}.
          {farmerName ? ` Play the message for ${farmerName}, then record their answer.` : ' Play the message, then record the answer.'}
        </p>
      </div>

      {promptLoading && (
        <div className="flex items-center gap-3 text-sm text-surface-600">
          <Spinner size="sm" />
          Preparing spoken prompt…
        </div>
      )}

      {promptError && <ErrorAlert>{promptError}</ErrorAlert>}

      {promptAudio?.audioUrl && (
        <div className="space-y-2">
          {promptAudio.textContent && (
            <p className="text-sm italic text-surface-700">&ldquo;{promptAudio.textContent}&rdquo;</p>
          )}
          <audio ref={audioRef} src={promptAudio.audioUrl} preload="auto" controls className="w-full" />
          <Button size="sm" variant="secondary" onClick={() => void loadPrompt()}>
            Replay prompt
          </Button>
        </div>
      )}

      {!recording && !processing && (
        <Button size="lg" className="w-full" onClick={() => setRecording(true)}>
          Record farmer&apos;s answer
        </Button>
      )}

      {recording && (
        <AudioRecorder
          label="Record the missing details"
          onRecordingComplete={(blob) => void handleRecordingComplete(blob)}
        />
      )}

      {processing && (
        <div className="flex items-center justify-center gap-3 py-4">
          <Spinner size="lg" />
          <span className="text-surface-600">Understanding the recording…</span>
        </div>
      )}

      {supplementError && <ErrorAlert>{supplementError}</ErrorAlert>}

      {lastTranscript && !supplementError && (
        <SuccessAlert>
          {lastOriginalTranscript ? (
            <>
              Original: &ldquo;{lastOriginalTranscript}&rdquo;
              <br />
              English: &ldquo;{lastTranscript}&rdquo;
            </>
          ) : (
            <>Heard: &ldquo;{lastTranscript}&rdquo;</>
          )}
        </SuccessAlert>
      )}
    </div>
  );
};

export default MissingFieldsVoicePrompt;
