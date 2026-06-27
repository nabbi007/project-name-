import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AIRun } from '../../api/admin.api';
import {
  Badge,
  EmptyState,
  ErrorAlert,
  Select,
  Skeleton,
  Button,
} from '../../components/shared';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PENDING', label: 'Pending' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'SPEECH_TO_TEXT', label: 'Speech to text' },
  { value: 'AGENT_CHAT', label: 'Agent chat' },
  { value: 'VISION', label: 'Vision' },
  { value: 'TEXT_TO_SPEECH', label: 'Text to speech' },
];

function statusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' | 'blue' {
  if (status === 'COMPLETED') return 'green';
  if (status === 'FAILED') return 'red';
  if (status === 'PROCESSING') return 'blue';
  return 'gray';
}

const AIRunRow: React.FC<{ run: AIRun }> = ({ run }) => {
  const [expanded, setExpanded] = useState(false);
  const isFailed = run.status === 'FAILED';
  const errorMsg = run.errorMessage ?? '';
  const truncated = errorMsg.length > 80;

  return (
    <tr className="hover:bg-surface-50 transition-colors">
      <td className="px-4 py-3 text-sm">{run.apiType}</td>
      <td className="px-4 py-3 text-sm">
        {run.relatedFarmerName ?? run.relatedListingTitle ?? '—'}
      </td>
      <td className="px-4 py-3">
        <Badge color={statusColor(run.status)}>{run.status}</Badge>
      </td>
      <td className="px-4 py-3 text-sm">{run.attemptCount}</td>
      <td className="px-4 py-3 text-sm text-red-700 max-w-xs">
        {isFailed && errorMsg ? (
          <>
            {expanded || !truncated ? errorMsg : `${errorMsg.slice(0, 80)}…`}
            {truncated && (
              <button
                type="button"
                className="ml-1 text-primary-600 underline text-xs"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? 'Show less' : 'View full'}
              </button>
            )}
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-sm text-surface-500">
        {new Date(run.createdAt).toLocaleDateString('en-GH')}
      </td>
    </tr>
  );
};

const AIMonitoring: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: runs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'ai-runs', statusFilter, typeFilter],
    queryFn: () =>
      adminApi.listAIRuns({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      }),
  });

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 tracking-tight">AI Monitoring</h1>
        <p className="text-sm text-surface-500 mt-2">Track speech, vision, and chat API runs across the platform.</p>
      </div>

      <div className="card p-5 lg:p-6">
        <h2 className="text-sm font-semibold text-surface-900">Filters</h2>
        <p className="text-xs text-surface-500 mt-1 mb-4">Filter runs by status and API type.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            label="API type"
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>
      </div>

      {isLoading && (
        <div className="card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <ErrorAlert>
          <p className="mb-3">Could not load AI runs.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </ErrorAlert>
      )}

      {!isLoading && !isError && runs.length === 0 && (
        <EmptyState title="No AI runs found" />
      )}

      {!isLoading && !isError && runs.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                <th className="px-4 py-3 font-medium">API type</th>
                <th className="px-4 py-3 font-medium">Related</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {runs.map((run) => (
                <AIRunRow key={run._id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AIMonitoring;
