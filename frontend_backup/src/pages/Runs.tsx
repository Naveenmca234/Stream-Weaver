import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { runsApi } from '../services/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { formatNumber, formatDuration } from '../utils';

export function Runs() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: async () => {
      const res = await runsApi.list();
      return res.data;
    },
    refetchInterval: 5000,
  });

  const runs = data?.runs || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Execution Runs</h1>
          <p className="text-sm text-gray-400 mt-1">Monitor active and historical pipeline executions</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-base-800 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder="Search run ID..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-400">
            {runs.length} runs total
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading runs...</div>
        ) : runs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-base-800 flex items-center justify-center mb-4 text-gray-500">
              <PlayCircle size={32} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No execution runs yet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-sm">
              Execute a pipeline to see the progress and results here.
            </p>
            <Button onClick={() => navigate('/pipelines')}>
              Go to Pipelines
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Run ID</th>
                  <th className="table-header">Pipeline</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Progress</th>
                  <th className="table-header">Throughput</th>
                  <th className="table-header">Started At</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run: any) => (
                  <tr key={run._id} className="hover:bg-base-800/50 transition-colors group cursor-pointer" onClick={() => navigate(`/runs/${run.runId}`)}>
                    <td className="table-cell font-mono text-xs text-accent-400">
                      {run.runId}
                    </td>
                    <td className="table-cell font-medium text-white">
                      {run.pipelineId?.name || 'Unknown Pipeline'}
                    </td>
                    <td className="table-cell">
                      <Badge variant={
                        run.status === 'COMPLETED' ? 'success' :
                        run.status === 'RUNNING' ? 'accent' :
                        run.status === 'FAILED' ? 'danger' :
                        run.status === 'COMPLETED_WITH_WARNINGS' ? 'warning' : 'neutral'
                      }>
                        {run.status === 'RUNNING' && <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse mr-1 inline-block" />}
                        {run.status}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-col gap-1 w-32">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">{formatNumber(run.processedRows)} rows</span>
                          <span className="text-gray-300">
                            {run.totalRows > 0 ? Math.round((run.processedRows / run.totalRows) * 100) : 0}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-base-950 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${run.status === 'FAILED' ? 'bg-danger-500' : 'bg-accent-500'}`}
                            style={{ width: `${run.totalRows > 0 ? Math.round((run.processedRows / run.totalRows) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-xs">
                      {formatNumber(run.avgThroughput)} <span className="text-gray-500">r/s</span>
                    </td>
                    <td className="table-cell text-xs text-gray-400">
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
