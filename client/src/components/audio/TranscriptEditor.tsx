import React, { useEffect, useState } from 'react';
import { Button } from '../shared/Button';
import { Spinner } from '../shared/Spinner';
import { TextArea } from '../shared/TextArea';

export type TranscriptStatus = 'idle' | 'uploading' | 'transcribing' | 'done' | 'failed';

interface TranscriptEditorProps {
  transcript: string;
  status: TranscriptStatus;
  errorMessage?: string;
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
  failed: 'Could not transcribe — type what the farmer said, or try again.',
};

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  transcript,
  status,
  errorMessage,
  onAccept,
  onRecordAgain,
  onRetryTranscription,
  retryPending = false,
}) => {
  const [edited, setEdited] = useState(transcript);
  const isProcessing = status === 'uploading' || status === 'transcribing';

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
          {errorMessage ?? statusMessages.failed}
        </p>
      )}

      <TextArea
        label="What the farmer said"
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
        rows={4}
        className="text-base"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          size="lg"
          className="flex-1"
          onClick={() => onAccept(edited.trim())}
          disabled={!edited.trim()}
        >
          Accept & continue
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
