import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import {
  Badge,
  Button,
  EmptyState,
  ErrorAlert,
  SearchInput,
  Skeleton,
} from '../../components/shared';

const AgentManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: agents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'agents', search],
    queryFn: () => adminApi.listAgents({ search: search || undefined }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      adminApi.updateAgentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      setPendingId(null);
    },
    onError: () => setPendingId(null),
  });

  const toggleStatus = (id: string, current: 'ACTIVE' | 'SUSPENDED') => {
    setPendingId(id);
    statusMutation.mutate({
      id,
      status: current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
    });
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 tracking-tight">Agents</h1>
        <p className="text-sm text-surface-500 mt-2">Search field agents and manage their account status.</p>
      </div>

      <div className="card p-5 lg:p-6">
        <h2 className="text-sm font-semibold text-surface-900">Search</h2>
        <p className="text-xs text-surface-500 mt-1 mb-4">Filter by name or phone number.</p>
        <SearchInput onSearch={setSearch} placeholder="Search agents by name or phone…" />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4">
              <Skeleton className="h-5 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <ErrorAlert>
          <p className="mb-3">Could not load agents.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </ErrorAlert>
      )}

      {!isLoading && !isError && agents.length === 0 && (
        <EmptyState title="No agents found" message="Try adjusting your search." />
      )}

      {!isLoading && !isError && agents.length > 0 && (
        <>
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Farmers</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {agents.map((agent) => (
                  <tr key={agent._id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-surface-900">{agent.name}</td>
                    <td className="px-4 py-3 text-surface-600">{agent.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={agent.status === 'ACTIVE' ? 'green' : 'red'}>
                        {agent.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{agent.farmerCount ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={agent.status === 'ACTIVE' ? 'danger' : 'primary'}
                        loading={pendingId === agent._id}
                        disabled={pendingId === agent._id}
                        onClick={() => toggleStatus(agent._id, agent.status)}
                      >
                        {agent.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {agents.map((agent) => (
              <div key={agent._id} className="card p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{agent.name}</p>
                    <p className="text-sm text-surface-500">{agent.phone ?? '—'}</p>
                  </div>
                  <Badge color={agent.status === 'ACTIVE' ? 'green' : 'red'}>
                    {agent.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                  </Badge>
                </div>
                <p className="text-sm text-surface-600">Farmers: {agent.farmerCount ?? 0}</p>
                <Button
                  size="lg"
                  variant={agent.status === 'ACTIVE' ? 'danger' : 'primary'}
                  className="w-full"
                  loading={pendingId === agent._id}
                  onClick={() => toggleStatus(agent._id, agent.status)}
                >
                  {agent.status === 'ACTIVE' ? 'Suspend agent' : 'Activate agent'}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AgentManagement;
