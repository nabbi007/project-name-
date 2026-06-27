import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, type Complaint } from '../../api/admin.api';
import {
  Badge,
  Button,
  EmptyState,
  ErrorAlert,
  Skeleton,
  TextArea,
} from '../../components/shared';

function statusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  if (status === 'RESOLVED') return 'green';
  if (status === 'OPEN') return 'yellow';
  if (status === 'REJECTED') return 'red';
  return 'gray';
}

const ComplaintCard: React.FC<{
  complaint: Complaint;
  onResolve: (id: string, resolution: string) => void;
  resolving: boolean;
}> = ({ complaint, onResolve, resolving }) => {
  const [expanded, setExpanded] = useState(false);
  const [resolution, setResolution] = useState('');

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-surface-900">Order {complaint.orderRef ?? '—'}</p>
          <p className="text-sm text-surface-500">{complaint.buyerName ?? 'Unknown buyer'}</p>
        </div>
        <Badge color={statusColor(complaint.status)}>{complaint.status}</Badge>
      </div>

      <p className="text-sm text-surface-700">{complaint.message}</p>
      <p className="text-xs text-surface-400">
        {new Date(complaint.createdAt).toLocaleString('en-GH')}
      </p>

      <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)}>
        {expanded ? 'Hide details' : 'View order details'}
      </Button>

      {expanded && complaint.order && (
        <div className="bg-surface-50 rounded-lg p-3 text-sm space-y-1 border border-surface-200">
          <p>
            <span className="font-medium">Order status:</span> {complaint.order.status ?? '—'}
          </p>
          {complaint.order.total != null && (
            <p>
              <span className="font-medium">Total:</span> GH₵ {complaint.order.total.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {complaint.status !== 'RESOLVED' && (
        <div className="space-y-2 pt-2 border-t border-surface-200">
          <TextArea
            label="Resolution notes"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
          />
          <Button
            size="lg"
            className="w-full"
            loading={resolving}
            disabled={!resolution.trim()}
            onClick={() => onResolve(complaint._id, resolution.trim())}
          >
            Mark resolved
          </Button>
        </div>
      )}

      {complaint.resolution && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">{complaint.resolution}</p>
      )}
    </div>
  );
};

const ComplaintManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data: complaints = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'complaints'],
    queryFn: adminApi.listComplaints,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      adminApi.resolveComplaint(id, resolution),
    onMutate: ({ id }) => setResolvingId(id),
    onSettled: () => {
      setResolvingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'complaints'] });
    },
  });

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 tracking-tight">Complaints</h1>
        <p className="text-sm text-surface-500 mt-2">Review buyer complaints and record resolutions.</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4">
              <Skeleton className="h-5 w-1/3 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <ErrorAlert>
          <p className="mb-3">Could not load complaints.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </ErrorAlert>
      )}

      {!isLoading && !isError && complaints.length === 0 && (
        <EmptyState title="No complaints" message="All clear for now." />
      )}

      {!isLoading && !isError && complaints.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          {complaints.map((c) => (
            <ComplaintCard
              key={c._id}
              complaint={c}
              resolving={resolvingId === c._id}
              onResolve={(id, resolution) => resolveMutation.mutate({ id, resolution })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ComplaintManagement;
