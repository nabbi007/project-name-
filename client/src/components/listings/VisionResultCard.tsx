import React, { useState } from 'react';
import { Button, Spinner, TextArea } from '../shared';
import { Badge } from '../shared/Badge';
import type { VisionObservation, VisionStatus } from '../../api/listings.api';
import { getListingImageUrl } from '../../api/listings.api';
import { VisionDescription } from './VisionDescription';

interface VisionResultCardProps {
  imageUrl?: string;
  observation?: VisionObservation;
  uploading?: boolean;
  onApprove: () => void;
  onReject: (explanation: string) => void;
  onUploadAnother: () => void;
  onContinueManual: () => void;
  reviewPending?: boolean;
  mode?: 'preview' | 'review';
}

const STATUS_CONFIG: Record<
  VisionStatus,
  { label: string; color: 'green' | 'yellow' | 'red' | 'gray' | 'blue'; showSpinner?: boolean }
> = {
  ANALYZING: { label: 'Analysing image…', color: 'blue', showSpinner: true },
  COMPLETED: { label: 'Analysis complete', color: 'green' },
  FAILED: { label: 'Analysis failed — you can continue with manual review', color: 'red' },
  NEEDS_HUMAN_REVIEW: { label: 'Needs human review', color: 'yellow' },
  PENDING: { label: 'Pending analysis', color: 'gray' },
};

export const VisionResultCard: React.FC<VisionResultCardProps> = ({
  imageUrl,
  observation,
  uploading = false,
  onApprove,
  onReject,
  onUploadAnother,
  onContinueManual,
  reviewPending = false,
  mode = 'review',
}) => {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectExplanation, setRejectExplanation] = useState('');

  const status: VisionStatus = uploading
    ? 'ANALYZING'
    : (observation?.status ?? 'PENDING');
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const resolvedImageUrl = getListingImageUrl(imageUrl);

  const handleRejectSubmit = () => {
    if (!rejectExplanation.trim()) return;
    onReject(rejectExplanation.trim());
    setShowRejectForm(false);
    setRejectExplanation('');
  };

  const canContinueManual = status === 'FAILED' || status === 'NEEDS_HUMAN_REVIEW';

  return (
    <div className="card p-6 space-y-4">
      {resolvedImageUrl && (
        <img
          src={resolvedImageUrl}
          alt="Uploaded crop"
          className="w-full max-h-56 object-cover rounded-lg border border-surface-200"
        />
      )}

      <div className="flex items-center gap-2">
        {config.showSpinner && <Spinner size="sm" />}
        <Badge color={config.color}>{config.label}</Badge>
      </div>

      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
        <p className="text-base font-bold text-amber-900">
          AI visual observation. Human confirmation is required.
        </p>
      </div>

      {observation?.description && (
        <VisionDescription description={observation.description} />
      )}

      {observation?.flaggedIssues && observation.flaggedIssues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-800 mb-2">Flagged issues</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
            {observation.flaggedIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {showRejectForm && (
        <TextArea
          label="Explain why this needs another look *"
          value={rejectExplanation}
          onChange={(e) => setRejectExplanation(e.target.value)}
          rows={3}
        />
      )}

      <div className="flex flex-col gap-3">
        {mode === 'review' && !showRejectForm && (
          <>
            <Button
              size="lg"
              onClick={onApprove}
              loading={reviewPending}
              disabled={uploading || status === 'ANALYZING'}
            >
              Approve observation
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setShowRejectForm(true)}
              disabled={uploading || reviewPending}
            >
              Reject — needs another look
            </Button>
          </>
        )}

        {mode === 'review' && showRejectForm && (
          <>
            <Button
              size="lg"
              variant="danger"
              onClick={handleRejectSubmit}
              disabled={!rejectExplanation.trim()}
              loading={reviewPending}
            >
              Submit rejection
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setShowRejectForm(false)}>
              Cancel
            </Button>
          </>
        )}

        <Button size="lg" variant="secondary" onClick={onUploadAnother} disabled={uploading}>
          Upload another image
        </Button>

        {canContinueManual && (
          <Button size="lg" variant="ghost" onClick={onContinueManual}>
            Continue with manual review
          </Button>
        )}
      </div>
    </div>
  );
};

export default VisionResultCard;
