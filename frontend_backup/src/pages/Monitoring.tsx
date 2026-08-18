import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldAlert, Key, Database, RefreshCw } from 'lucide-react';
import { monitoringApi } from '../services/api';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

export function Monitoring() {
  const { data: health, refetch: refetchHealth, isLoading: isLoadingHealth } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await monitoringApi.getHealth();
      return res.data;
    },
  });

  const { data: auditLogs, refetch: refetchLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await monitoringApi.getAuditLogs({ limit: 50 });
      return res.data;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Monitoring</h1>
          <p className="text-sm text-gray-400 mt-1">Health checks and security audit logs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { refetchHealth(); refetchLogs(); }}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Database className="text-accent-400" size={18} /> API Server
            </h3>
            <Badge variant={health?.status === 'ok' ? 'success' : 'danger'}>
              {health?.status || 'unknown'}
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Environment</span>
              <span className="text-white">{health?.environment}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Uptime</span>
              <span className="text-white font-mono">{Math.floor((health?.uptime || 0) / 60)} mins</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-800">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="text-warning-400" size={18} /> Security Audit Logs
          </h3>
        </div>
        
        {isLoadingLogs ? (
          <div className="p-8 text-center text-gray-500">Loading audit logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">Timestamp</th>
                  <th className="table-header">Action</th>
                  <th className="table-header">User</th>
                  <th className="table-header">Resource Type</th>
                  <th className="table-header">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs?.logs?.map((log: any) => (
                  <tr key={log._id} className="hover:bg-base-800/50 transition-colors">
                    <td className="table-cell font-mono text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="table-cell">
                      <Badge variant="neutral">{log.action}</Badge>
                    </td>
                    <td className="table-cell text-white">
                      {log.userId?.email || log.userId?.name || 'System'}
                    </td>
                    <td className="table-cell capitalize text-gray-300">
                      {log.resourceType}
                    </td>
                    <td className="table-cell font-mono text-xs text-gray-500">
                      {log.ipAddress}
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
