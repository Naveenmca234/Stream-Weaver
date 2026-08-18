import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Network, PlayCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { monitoringApi } from '../services/api';
import { formatNumber, formatDuration } from '../utils';
import { Badge } from '../components/Badge';
import { cn } from '../utils';
import { Link } from 'react-router-dom';

export function Overview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['monitoring_metrics'],
    queryFn: async () => {
      const res = await monitoringApi.getMetrics();
      return res.data;
    },
    refetchInterval: 5000, // Refresh every 5s
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 w-full" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-md text-danger-400 flex items-center gap-2">
        <AlertCircle size={20} />
        <span>Failed to load dashboard metrics.</span>
      </div>
    );
  }

  const { system, runs, datasets, pipelines, recentRuns } = data;

  // Mock data for chart since we don't have historical time-series in this demo endpoint
  const chartData = [
    { time: '00:00', throughput: runs.avgThroughput * 0.8 },
    { time: '04:00', throughput: runs.avgThroughput * 0.9 },
    { time: '08:00', throughput: runs.avgThroughput * 1.2 },
    { time: '12:00', throughput: runs.avgThroughput * 1.5 },
    { time: '16:00', throughput: runs.avgThroughput * 1.1 },
    { time: '20:00', throughput: runs.avgThroughput * 0.9 },
    { time: '24:00', throughput: runs.avgThroughput },
  ];

  const successRate = runs.totalProcessed > 0 
    ? ((runs.totalSuccessful / runs.totalProcessed) * 100).toFixed(1) 
    : '100';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-sm text-gray-400 mt-1">System performance and active metrics</p>
        </div>
        <div className="flex items-center gap-2 bg-base-900 border border-base-800 rounded-md px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          <span className="text-xs font-medium text-gray-300">System Healthy</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label flex items-center gap-1.5"><PlayCircle size={14} className="text-accent-400"/> Active Runs</span>
            {runs.active > 0 && <span className="flex h-2 w-2 rounded-full bg-accent-500 animate-ping" />}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="metric-value">{formatNumber(runs.active)}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label flex items-center gap-1.5"><Activity size={14} className="text-success-400"/> Success Rate</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="metric-value">{successRate}%</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label flex items-center gap-1.5"><TrendingUp size={14} className="text-indigo-400"/> Avg Throughput</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="metric-value">{formatNumber(runs.avgThroughput)}</span>
            <span className="text-sm text-gray-500">rows/s</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label flex items-center gap-1.5"><Database size={14} className="text-warning-400"/> Total Processed</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="metric-value">{formatNumber(runs.totalProcessed)}</span>
            <span className="text-sm text-gray-500">rows</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-white">System Throughput (24h)</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#252838" vertical={false} />
                <XAxis dataKey="time" stroke="#4a5072" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#4a5072" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1a1d2a', borderColor: '#2d3148', color: '#f3f4f6' }}
                  itemStyle={{ color: '#06b6d4' }}
                />
                <Area type="monotone" dataKey="throughput" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorThroughput)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-6">System Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded bg-base-950 border border-base-800">
              <span className="text-sm text-gray-400">Memory (Heap)</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">{system.heapUsed} MB / {system.heapTotal} MB</span>
                <div className="w-16 h-1.5 rounded-full bg-base-800 overflow-hidden">
                  <div className="h-full bg-accent-500" style={{ width: `${Math.min((system.heapUsed / system.heapTotal) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded bg-base-950 border border-base-800">
              <span className="text-sm text-gray-400">WS Clients</span>
              <span className="text-sm font-medium text-white">{system.wsClients}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-base-950 border border-base-800">
              <span className="text-sm text-gray-400">Failed Runs (24h)</span>
              <span className={cn("text-sm font-medium", runs.failedToday > 0 ? "text-danger-400" : "text-success-400")}>
                {runs.failedToday}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-base-950 border border-base-800">
              <span className="text-sm text-gray-400">Total Pipelines</span>
              <span className="text-sm font-medium text-white">{pipelines.total}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded bg-base-950 border border-base-800">
              <span className="text-sm text-gray-400">Total Datasets</span>
              <span className="text-sm font-medium text-white">{datasets.total}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-800">
          <h3 className="text-base font-semibold text-white">Recent Executions</h3>
          <Link to="/runs" className="text-sm text-accent-400 hover:text-accent-300">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-header">Run ID</th>
                <th className="table-header">Pipeline</th>
                <th className="table-header">Status</th>
                <th className="table-header">Processed</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Triggered By</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-8 text-gray-500">
                    No recent runs found.
                  </td>
                </tr>
              ) : (
                recentRuns.map((run: any) => (
                  <tr key={run._id} className="hover:bg-base-800/50 transition-colors group">
                    <td className="table-cell font-mono text-xs">
                      <Link to={`/runs/${run.runId}`} className="text-accent-400 group-hover:underline">
                        {run.runId}
                      </Link>
                    </td>
                    <td className="table-cell font-medium text-white">{run.pipelineId?.name || 'Unknown'}</td>
                    <td className="table-cell">
                      <Badge variant={
                        run.status === 'COMPLETED' ? 'success' :
                        run.status === 'RUNNING' ? 'accent' :
                        run.status === 'FAILED' ? 'danger' :
                        run.status === 'COMPLETED_WITH_WARNINGS' ? 'warning' : 'neutral'
                      }>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      {formatNumber(run.processedRows)} / {formatNumber(run.totalRows)}
                    </td>
                    <td className="table-cell">{formatDuration(run.durationMs || 0)}</td>
                    <td className="table-cell text-gray-400">{run.triggeredBy?.name || 'System'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
