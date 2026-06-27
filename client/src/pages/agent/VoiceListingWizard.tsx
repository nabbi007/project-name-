import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { farmersApi } from '../../api/farmers.api';
import {
  getPublicationBlockers,
  isPublishBlockedError,
  listingsApi,
  type GeneratedAudio,
  type Listing,
} from '../../api/listings.api';
import { voiceApi, type VoiceStep } from '../../api/voice.api';
import { GeneratedAudioPlayer } from '../../components/audio/GeneratedAudioPlayer';
import { AudioRecorder } from '../../components/audio/AudioRecorder';
import {
  TranscriptEditor,
  type TranscriptStatus,
} from '../../components/audio/TranscriptEditor';
import { ListingForm } from '../../components/listings/ListingForm';
import { ListingImageUploader } from '../../components/listings/ListingImageUploader';
import { ListingPreview } from '../../components/listings/ListingPreview';
import { VisionResultCard } from '../../components/listings/VisionResultCard';
import {
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorAlert,
  Spinner,
  SuccessAlert,
} from '../../components/shared';

/** Five user-facing phases (voice questions stay grouped inside phase 2). */
const PHASES = [
  { id: 1, label: 'Farmer' },
  { id: 2, label: 'Voice' },
  { id: 3, label: 'Details' },
  { id: 4, label: 'Photo' },
  { id: 5, label: 'Publish' },
] as const;

const VOICE_STEPS: { step: VoiceStep; label: string; question: string; optional?: boolean }[] = [
  { step: 'CROP', label: 'Crop', question: 'What crop do you have?' },
  { step: 'QUANTITY', label: 'Quantity', question: 'How much do you have?' },
  { step: 'UNIT', label: 'Unit', question: 'What unit is it measured in?' },
  { step: 'AVAILABILITY', label: 'Availability', question: 'When will it be available?' },
  { step: 'PRICE', label: 'Price', question: 'What price per unit?' },
  {
    step: 'DESCRIPTION',
    label: 'Extra info',
    question: 'Any additional information?',
    optional: true,
  },
];

const EXTRACTION_MESSAGES = [
  'Reviewing farmer responses…',
  'Understanding crop details…',
  'Preparing listing information…',
];

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  tw: 'Twi',
  ga: 'Ga',
  ee: 'Ewe',
};

/** Map publish blockers to wizard phase for "Fix this". */
const FIX_PHASE_MAP: Record<string, number> = {
  crop: 3,
  quantity: 3,
  unit: 3,
  pricePerUnit: 3,
  price: 3,
  availableDate: 3,
  description: 3,
  region: 3,
  community: 3,
  image: 4,
  imageUrl: 4,
  visionReview: 4,
  vision: 4,
  agentConfirmed: 4,
};

interface AcceptedTranscript {
  step: VoiceStep;
  label: string;
  transcript: string;
}

type PublishState = 'idle' | 'publishing' | 'success' | 'blocked' | 'failed';
type VoiceMode = 'record' | 'review';

const VoiceListingWizard: React.FC = () => {
  const { farmerId } = useParams<{ farmerId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);

  const [voiceMode, setVoiceMode] = useState<VoiceMode>('record');
  const [voiceStepIndex, setVoiceStepIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [originalTranscript, setOriginalTranscript] = useState<string | undefined>();
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>('idle');
  const [translationMissing, setTranslationMissing] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [acceptedTranscripts, setAcceptedTranscripts] = useState<AcceptedTranscript[]>([]);
  const [showRecorder, setShowRecorder] = useState(true);
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractionMessageIndex, setExtractionMessageIndex] = useState(0);
  const [listing, setListing] = useState<Listing | null>(null);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [listingSaved, setListingSaved] = useState(false);

  const [imageUploading, setImageUploading] = useState(false);
  const [showImageUploader, setShowImageUploader] = useState(true);
  const [visionReviewDone, setVisionReviewDone] = useState(false);
  const [visionReviewPending, setVisionReviewPending] = useState(false);

  const [publishState, setPublishState] = useState<PublishState>('idle');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<GeneratedAudio | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [ackPending, setAckPending] = useState(false);
  const [confirmationComplete, setConfirmationComplete] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const sessionRequested = useRef(false);
  const sessionPromiseRef = useRef<Promise<string | null> | null>(null);
  const extractionStarted = useRef(false);

  const { data: farmer, isLoading, isError } = useQuery({
    queryKey: ['farmer', farmerId],
    queryFn: () => farmersApi.getFarmer(farmerId!),
    enabled: Boolean(farmerId),
  });

  const ensureVoiceSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!farmerId) return null;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    sessionRequested.current = true;
    setSessionStarting(true);
    setSessionError(null);

    const promise = voiceApi
      .createVoiceSession(farmerId)
      .then((session) => {
        setSessionId(session._id);
        return session._id;
      })
      .catch(() => {
        sessionRequested.current = false;
        setSessionError('Could not start the voice session. Check your connection and try again.');
        return null;
      })
      .finally(() => {
        setSessionStarting(false);
        sessionPromiseRef.current = null;
      });

    sessionPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    if (farmer && !sessionId && !sessionRequested.current) {
      void ensureVoiceSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmer, farmerId]);

  const currentVoiceStep = VOICE_STEPS[voiceStepIndex];
  const requiredVoiceCount = VOICE_STEPS.filter((s) => !s.optional).length;
  const acceptedRequiredCount = acceptedTranscripts.filter(
    (t) => !VOICE_STEPS.find((s) => s.step === t.step)?.optional
  ).length;

  const runExtraction = async () => {
    if (!sessionId) return;
    setExtracting(true);
    try {
      await voiceApi.completeVoiceSession(sessionId);
    } catch {
      // no-op
    }
    try {
      const extracted = await listingsApi.extractListing(sessionId);
      setListing({
        ...extracted,
        farmerName: farmer?.fullName,
        community: extracted.community ?? farmer?.community,
      });
      setExtractionFailed(false);
    } catch {
      setListing({
        _id: '',
        farmer: farmerId ?? '',
        farmerName: farmer?.fullName,
        community: farmer?.community,
      });
      setExtractionFailed(true);
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    if (phase !== 3 || extractionStarted.current || !sessionId) return;
    extractionStarted.current = true;
    void runExtraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionId]);

  useEffect(() => {
    if (!extracting) return;
    const interval = setInterval(() => {
      setExtractionMessageIndex((i) => (i + 1) % EXTRACTION_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [extracting]);

  const handleRecordingComplete = async (blob: Blob) => {
    if (!sessionId || !farmer || !currentVoiceStep) return;
    setShowRecorder(false);
    setTranscriptStatus('uploading');
    try {
      setTranscriptStatus('transcribing');
      const result = await voiceApi.uploadVoiceResponse(sessionId, {
        audioBlob: blob,
        step: currentVoiceStep.step,
        language: farmer.preferredLanguage ?? 'en',
      });
      setLastResponseId(result.responseId);
      setTranscript(result.transcript);
      setOriginalTranscript(result.originalTranscript);
      setTranslationMissing(Boolean(result.translationMissing));
      setTranscriptStatus(result.transcriptionFailed ? 'failed' : 'done');
    } catch {
      setLastResponseId(null);
      setTranscript('');
      setOriginalTranscript(undefined);
      setTranslationMissing(false);
      setTranscriptStatus('failed');
    }
  };

  const handleRetryTranscription = async () => {
    if (!lastResponseId) return;
    setRetryPending(true);
    setTranscriptStatus('transcribing');
    try {
      const result = await voiceApi.retryTranscription(lastResponseId);
      setTranscript(result.transcript);
      setOriginalTranscript(result.originalTranscript);
      setTranslationMissing(Boolean(result.translationMissing));
      setTranscriptStatus(result.transcriptionFailed ? 'failed' : 'done');
    } catch {
      setTranscriptStatus('failed');
    } finally {
      setRetryPending(false);
    }
  };

  const handleAcceptTranscript = async (editedTranscript: string) => {
    if (!sessionId || !currentVoiceStep) return;
    try {
      await voiceApi.editVoiceResponse(
        sessionId,
        currentVoiceStep.step,
        editedTranscript,
        lastResponseId ?? undefined
      );
    } catch {
      // continue locally
    }
    setAcceptedTranscripts((prev) => {
      const filtered = prev.filter((t) => t.step !== currentVoiceStep.step);
      return [
        ...filtered,
        { step: currentVoiceStep.step, label: currentVoiceStep.label, transcript: editedTranscript },
      ];
    });
    setShowRecorder(false);
  };

  const advanceVoiceQuestion = () => {
    setShowRecorder(true);
    setTranscript('');
    setOriginalTranscript(undefined);
    setTranscriptStatus('idle');
    setTranslationMissing(false);
    setLastResponseId(null);
    if (voiceStepIndex < VOICE_STEPS.length - 1) {
      setVoiceStepIndex((i) => i + 1);
    } else {
      setVoiceMode('review');
    }
  };

  const skipOptionalQuestion = () => {
    setVoiceMode('review');
  };

  const goToVoiceQuestion = (index: number) => {
    setVoiceStepIndex(index);
    setVoiceMode('record');
    setShowRecorder(true);
    setTranscript('');
    setOriginalTranscript(undefined);
    setTranscriptStatus('idle');
    setTranslationMissing(false);
    setLastResponseId(null);
  };

  const handleSaveListing = async (payload: Parameters<typeof listingsApi.updateListing>[1]) => {
    if (!listing?._id) return;
    setSavingListing(true);
    try {
      const updated = await listingsApi.updateListing(listing._id, payload);
      setListing({ ...updated, farmerName: farmer?.fullName });
      setListingSaved(true);
    } finally {
      setSavingListing(false);
    }
  };

  const handleImageUpload = async (file: File, onProgress: (pct: number) => void) => {
    if (!listing?._id) throw new Error('No listing');
    setImageUploading(true);
    try {
      const updated = await listingsApi.uploadListingImage(listing._id, file, onProgress);
      setListing({ ...updated, farmerName: farmer?.fullName });
      setShowImageUploader(false);
      setVisionReviewDone(false);
    } finally {
      setImageUploading(false);
    }
  };

  const handleVisionApprove = async () => {
    if (!listing?._id) return;
    setVisionReviewPending(true);
    try {
      const updated = await listingsApi.submitVisionReview(listing._id, { approved: true });
      setListing({ ...updated, farmerName: farmer?.fullName });
      setVisionReviewDone(true);
    } catch {
      setVisionReviewDone(true);
    } finally {
      setVisionReviewPending(false);
    }
  };

  const handleVisionReject = async (explanation: string) => {
    if (!listing?._id) return;
    setVisionReviewPending(true);
    try {
      const updated = await listingsApi.submitVisionReview(listing._id, {
        approved: false,
        explanation,
      });
      setListing({ ...updated, farmerName: farmer?.fullName });
      setShowImageUploader(true);
      setVisionReviewDone(false);
    } catch {
      setShowImageUploader(true);
    } finally {
      setVisionReviewPending(false);
    }
  };

  const handlePublish = async () => {
    if (!listing?._id) return;
    setPublishState('publishing');
    setMissingFields([]);
    try {
      const updated = await listingsApi.publishListing(listing._id);
      setListing({ ...updated, farmerName: farmer?.fullName });
      setPublishState('success');
      void loadConfirmationAudio(updated._id);
    } catch (err) {
      if (isPublishBlockedError(err)) {
        setMissingFields(getPublicationBlockers(err));
        setPublishState('blocked');
      } else {
        setPublishState('failed');
      }
    }
  };

  const loadConfirmationAudio = async (listingId: string) => {
    setAudioLoading(true);
    try {
      const audio = await listingsApi.generateConfirmationAudio(listingId, 'PUBLISHED');
      setGeneratedAudio(audio);
    } catch {
      setGeneratedAudio(null);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleAck = async (payload: { farmerHeard: boolean; farmerConfirmed: boolean }) => {
    if (!generatedAudio?._id) return;
    setAckPending(true);
    try {
      await listingsApi.ackConfirmationAudio(generatedAudio._id, payload);
      setConfirmedAt(new Date().toISOString());
      setConfirmationComplete(true);
    } catch {
      setConfirmedAt(new Date().toISOString());
      setConfirmationComplete(true);
    } finally {
      setAckPending(false);
    }
  };

  const isCurrentStepAccepted = acceptedTranscripts.some((t) => t.step === currentVoiceStep?.step);
  const canStartVoice = acceptedRequiredCount >= requiredVoiceCount;

  const startVoicePhase = async () => {
    const id = await ensureVoiceSession();
    if (id) {
      setVoiceMode('record');
      setVoiceStepIndex(0);
      setPhase(2);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !farmer) {
    return (
      <EmptyState
        title="Farmer not found"
        actionLabel="Back to farmers"
        onAction={() => navigate('/agent/farmers')}
      />
    );
  }

  const previewListing: Listing = {
    ...(listing ?? { _id: '', farmer: farmerId ?? '' }),
    farmerName: farmer.fullName,
    community: listing?.community ?? farmer.community,
  };

  const langLabel =
    LANGUAGE_LABELS[farmer.preferredLanguage ?? ''] ?? farmer.preferredLanguage ?? 'English';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/agent/farmers/${farmerId}`} className="text-sm text-primary-600 hover:underline shrink-0">
          ← Back
        </Link>
        <span className="text-sm font-medium text-surface-600">
          {PHASES[phase - 1]?.label} · Step {phase} of {PHASES.length}
        </span>
      </div>

      {/* Phase stepper */}
      <nav aria-label="Listing progress" className="flex gap-1">
        {PHASES.map((p) => {
          const done = p.id < phase;
          const active = p.id === phase;
          return (
            <div
              key={p.id}
              className={`flex-1 text-center py-2 px-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-600 text-white'
                  : done
                    ? 'bg-primary-100 text-primary-800'
                    : 'bg-surface-100 text-surface-400'
              }`}
            >
              {p.label}
            </div>
          );
        })}
      </nav>

      {/* Phase 1 — Farmer */}
      {phase === 1 && (
        <div className="card p-6 space-y-4">
          <h1 className="text-xl font-bold">Who is this listing for?</h1>
          <p className="text-surface-600 text-sm">
            Record short answers in {langLabel}. Type the English meaning after each recording.
          </p>
          <div className="bg-surface-50 rounded-lg p-4">
            <p className="text-lg font-semibold">{farmer.fullName}</p>
            <p className="text-surface-600 text-sm mt-1">Language: {langLabel}</p>
            {farmer.community && (
              <p className="text-surface-500 text-sm">{farmer.community}, {farmer.region}</p>
            )}
          </div>
          <Link to="/agent/farmers" className="text-sm text-primary-600 hover:underline">
            Choose a different farmer
          </Link>
          {sessionError && (
            <ErrorAlert>
              {sessionError}
              <button
                type="button"
                className="ml-2 underline font-medium"
                onClick={() => {
                  sessionRequested.current = false;
                  sessionPromiseRef.current = null;
                  void ensureVoiceSession();
                }}
              >
                Retry
              </button>
            </ErrorAlert>
          )}
          <Button size="lg" className="w-full" loading={sessionStarting} onClick={startVoicePhase}>
            Start voice recording
          </Button>
        </div>
      )}

      {/* Phase 2 — Voice (all questions + review) */}
      {phase === 2 && voiceMode === 'record' && currentVoiceStep && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">Record answers</h1>
            <p className="text-surface-600 text-sm mt-1">
              Question {voiceStepIndex + 1} of {VOICE_STEPS.length} · {currentVoiceStep.label}
            </p>
          </div>

          <div className="flex gap-1">
            {VOICE_STEPS.map((s, i) => {
              const done = acceptedTranscripts.some((t) => t.step === s.step);
              const current = i === voiceStepIndex;
              return (
                <button
                  key={s.step}
                  type="button"
                  title={s.label}
                  onClick={() => done && goToVoiceQuestion(i)}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    current ? 'bg-primary-600' : done ? 'bg-primary-300' : 'bg-surface-200'
                  }`}
                />
              );
            })}
          </div>

          {showRecorder && (
            <AudioRecorder
              label={currentVoiceStep.question}
              onRecordingComplete={handleRecordingComplete}
            />
          )}
          {!showRecorder && (
            <TranscriptEditor
              transcript={transcript}
              originalTranscript={originalTranscript}
              sourceLanguageLabel={langLabel}
              status={transcriptStatus}
              translationMissing={translationMissing}
              onAccept={handleAcceptTranscript}
              onRetryTranscription={lastResponseId ? handleRetryTranscription : undefined}
              retryPending={retryPending}
              onRecordAgain={() => {
                setShowRecorder(true);
                setTranscript('');
                setOriginalTranscript(undefined);
                setTranscriptStatus('idle');
                setTranslationMissing(false);
              }}
            />
          )}
          {currentVoiceStep.optional && !isCurrentStepAccepted && (
            <Button size="lg" variant="secondary" className="w-full" onClick={skipOptionalQuestion}>
              Skip optional question
            </Button>
          )}
          {isCurrentStepAccepted && (
            <Button size="lg" className="w-full" onClick={advanceVoiceQuestion}>
              {voiceStepIndex < VOICE_STEPS.length - 1 ? 'Next question' : 'Review answers'}
            </Button>
          )}
        </div>
      )}

      {phase === 2 && voiceMode === 'review' && (
        <div className="card p-6 space-y-4">
          <h1 className="text-xl font-bold">Review answers</h1>
          <p className="text-surface-600 text-sm">
            {acceptedTranscripts.length} answer{acceptedTranscripts.length !== 1 ? 's' : ''} recorded.
            Tap a row to re-record.
          </p>
          <ul className="space-y-2">
            {acceptedTranscripts.map((item) => (
              <li key={item.step} className="border border-surface-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 text-sm">{item.label}</p>
                    <p className="text-surface-700 mt-0.5 text-sm">{item.transcript}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const idx = VOICE_STEPS.findIndex((s) => s.step === item.step);
                      if (idx >= 0) goToVoiceQuestion(idx);
                    }}
                  >
                    Re-record
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            className="w-full"
            disabled={!canStartVoice}
            onClick={() => setPhase(3)}
          >
            Build listing from answers
          </Button>
        </div>
      )}

      {/* Phase 3 — Details (extraction + form) */}
      {phase === 3 && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Listing details</h1>
          {extracting ? (
            <div className="card p-8 flex flex-col items-center gap-4 text-center">
              <Spinner size="lg" />
              <p className="text-surface-600">{EXTRACTION_MESSAGES[extractionMessageIndex]}</p>
            </div>
          ) : (
            <>
              {extractionFailed && (
                <ErrorAlert>
                  AI could not auto-fill everything — complete the form below manually.
                </ErrorAlert>
              )}
              <div className="card p-6">
                <ListingForm
                  initialValues={listing ?? undefined}
                  onSave={handleSaveListing}
                  saving={savingListing}
                />
              </div>
              {(listingSaved || listing?._id) && (
                <Button size="lg" className="w-full" onClick={() => setPhase(4)}>
                  Continue to photo
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Phase 4 — Photo + vision on one screen */}
      {phase === 4 && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Crop photo</h1>
          <p className="text-surface-600 text-sm">
            Add a clear photo of the produce, then confirm the AI quality check.
          </p>

          {(!listing?.imageUrl || showImageUploader) && (
            <ListingImageUploader
              onUpload={handleImageUpload}
              disabled={!listing?._id || imageUploading}
            />
          )}

          {listing?.imageUrl && !showImageUploader && (
            <VisionResultCard
              imageUrl={listing.imageUrl}
              observation={listing.visionObservation}
              uploading={imageUploading}
              onApprove={handleVisionApprove}
              onReject={handleVisionReject}
              onUploadAnother={() => setShowImageUploader(true)}
              onContinueManual={() => setVisionReviewDone(true)}
              reviewPending={visionReviewPending}
              mode="review"
            />
          )}

          {visionReviewDone && (
            <Button size="lg" className="w-full" onClick={() => setPhase(5)}>
              Preview & publish
            </Button>
          )}
        </div>
      )}

      {/* Phase 5 — Publish + farmer confirmation */}
      {phase === 5 && (
        <div className="space-y-4">
          {confirmationComplete ? (
            <div className="card p-8 text-center space-y-4">
              <SuccessAlert>Listing is live — farmer confirmed!</SuccessAlert>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button size="lg" onClick={() => navigate('/agent/farmers')}>
                  Back to farmers
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => navigate(`/agent/farmers/${farmerId}/create-listing`)}
                >
                  Create another
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold">Preview & publish</h1>
              <ListingPreview listing={previewListing} farmerDisplayName={farmer.fullName} />

              {publishState === 'blocked' && missingFields.length > 0 && (
                <ErrorAlert>
                  <p className="font-medium mb-2">Still needed before going live:</p>
                  <ul className="space-y-2">
                    {missingFields.map((field) => (
                      <li key={field} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{field}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPhase(FIX_PHASE_MAP[field] ?? 3)}
                        >
                          Fix
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ErrorAlert>
              )}

              {publishState === 'failed' && (
                <ErrorAlert>Could not publish. Please try again.</ErrorAlert>
              )}

              {publishState === 'success' && (
                <SuccessAlert>Listing is live on the marketplace.</SuccessAlert>
              )}

              {publishState !== 'success' && (
                <div className="flex flex-col gap-3">
                  <Button size="lg" variant="secondary" onClick={() => setPhase(3)}>
                    Edit details
                  </Button>
                  <Button
                    size="lg"
                    loading={publishState === 'publishing'}
                    disabled={publishState === 'publishing' || !listing?._id}
                    onClick={handlePublish}
                  >
                    Publish listing
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => navigate('/agent/farmers')}>
                    Save draft & exit
                  </Button>
                </div>
              )}

              {publishState === 'success' && (
                <div className="card p-6 space-y-4">
                  <h2 className="font-semibold">Play confirmation to farmer</h2>
                  <p className="text-sm text-surface-600">
                    Optional: play the audio so the farmer hears their listing is live.
                  </p>
                  {generatedAudio ? (
                    <GeneratedAudioPlayer
                      audioUrl={generatedAudio.audioUrl}
                      loading={audioLoading}
                      onRegenerate={() => listing?._id && loadConfirmationAudio(listing._id)}
                      onAck={handleAck}
                      ackPending={ackPending}
                      confirmedAt={confirmedAt}
                    />
                  ) : audioLoading ? (
                    <div className="flex justify-center py-6">
                      <Spinner size="lg" />
                    </div>
                  ) : (
                    <Button size="lg" variant="secondary" onClick={() => setConfirmationComplete(true)}>
                      Skip audio & finish
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmationDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={() => navigate('/agent/farmers')}
        title="Leave this listing?"
        message="Your draft will stay saved. You can continue later from the farmer profile."
        confirmLabel="Leave wizard"
        variant="danger"
      />

      {phase > 1 && phase < 5 && !confirmationComplete && (
        <button
          type="button"
          className="text-sm text-surface-500 hover:text-red-600 underline w-full text-center"
          onClick={() => setShowCancelDialog(true)}
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default VoiceListingWizard;
