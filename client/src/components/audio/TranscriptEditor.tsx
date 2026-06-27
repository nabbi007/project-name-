import React, { useEffect, useState } from 'react';
import { Button } from '../shared/Button';
import { Spinner } from '../shared/Spinner';
import { TextArea } from '../shared/TextArea';

export type TranscriptStatus = 'idle' | 'uploading' | 'transcribing' | 'done' | 'failed';

interface TranscriptEditorProps {
  transcript: string;
  originalTranscript?: string;
  sourceLanguageLabel?: string;
  status: TranscriptStatus;
  translationMissing?: boolean;
  onAccept: (editedTranscript: string) => void;
  onRecordAgain: () => void;
  onRetryTranscription?: () => void;
  retryPending?: boolean;
}

const statusMessages: Record<TranscriptStatus, string> = {
  idle: '',
  uploading: 'Uploading recording…',
  transcribing: 'Transcribing recording…',
  done: '',
  failed: 'Could not transcribe the audio — type what the farmer said in English, or try again.',
};

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  transcript,
  originalTranscript,
  sourceLanguageLabel,
  status,
  translationMissing = false,
  onAccept,
  onRecordAgain,
  onRetryTranscription,
  retryPending = false,
}) => {
  const [edited, setEdited] = useState(transcript);
  const isProcessing = status === 'uploading' || status === 'transcribing';
  const englishLabel = originalTranscript || translationMissing ? 'English translation' : 'Transcript';

  useEffect(() => {
    setEdited(transcript);
  }, [transcript]);

  if (isProcessing) {
    return (
      <div className="card p-6 flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-base font-medium text-surface-700">{statusMessages[status]}</p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      {status === 'failed' && (
        <p className="text-base text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
          {statusMessages.failed}
        </p>
      )}

      {translationMissing && status !== 'failed' && (
        <p className="text-base text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
          Check the original {sourceLanguageLabel ?? 'language'} text below and type the English
          meaning.
        </p>
      )}

      {originalTranscript && (
        <div className="text-sm text-surface-600 bg-surface-50 border border-surface-200 rounded-lg p-3">
          <p className="font-medium text-surface-700 mb-1">
            Original {sourceLanguageLabel ? `(${sourceLanguageLabel})` : ''}
          </p>
          <p>{originalTranscript}</p>
        </div>
      )}

      <TextArea
        label={englishLabel}
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
        rows={4}
        className="text-base"
        placeholder={
          translationMissing || originalTranscript
            ? 'Type the English meaning here…'
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          size="lg"
          className="flex-1"
          onClick={() => onAccept(edited.trim())}
          disabled={!edited.trim()}
        >
          Accept transcript
        </Button>
        <Button size="lg" variant="secondary" className="flex-1" onClick={onRecordAgain}>
          Record again
        </Button>
        {status === 'failed' && onRetryTranscription && (
          <Button
            size="lg"
            variant="secondary"
            className="flex-1"
            loading={retryPending}
            onClick={onRetryTranscription}
          >
            Retry transcription
          </Button>
        )}
      </div>
    </div>
  );
};

export default TranscriptEditor;
