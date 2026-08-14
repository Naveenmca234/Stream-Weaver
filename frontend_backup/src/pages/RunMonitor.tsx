import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, PlayCircle, StopCircle, Clock, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { runsApi } from '../services/api';
import { wsClient } from '../services/websocket';
import { formatNumber, formatDuration } from '../utils';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { RunStatus } from '../types';
import { cn } from '../utils';

export function RunMonitor() {
  const { id } = useParams<{ id: string }>();
  const [liveMetrics, setLiveMetrics] = useState<any>(null);

  const { data: run, isLoading } = useQuery({
    queryKey: ['run', id],
    queryFn: async () => {
      const res = await runsApi.get(id!);
      return res.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;

    const handleProgress = (payload: any) => {
      if (payload.runId === id) {
        setLiveMetrics(payload);
      }
    };

    const unsubscribe = wsClient.on('pipeline.progress', handleProgress);
    return () => unsubscribe();
  }, [id]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading run metrics...</div>;
  if (!run) return <div className="p-8 text-center text-danger-400">Run not found</div>;

  const currentStatus: RunStatus = liveMetrics?.status || run.status;
  const isRunning = currentStatus === 'RUNNING';
  const isCompleted = currentStatus === 'COMPLETED' || currentStatus === 'COMPLETED_WITH_WARNINGS';
  const isFailed = currentStatus === 'FAILED';
  
  const processed = liveMetrics?.processedRows || run.processedRows;
  const successful = liveMetrics?.successfulRows || run.successfulRows;
  const failed = liveMetrics?.failedRows || run.failedRows;
  const total = run.totalRows || processed; // Fallback if total is unknown
  
  const progressPercent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  
  // Fake duration ticker if running
  const duration = isRunning 
    ? Date.now() - new Date(run.createdAt).getTime()
    : run.durationMs;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/runs" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Execution Run</h1>
            <Badge variant={
              currentStatus === 'RUNNING' ? 'accent' :
              isCompleted ? 'success' :
              isFailed ? 'danger' : 'neutral'
            }>
              {currentStatus === 'RUNNING' && <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse mr-1.5 inline-block" />}
              {currentStatus}
            </Badge>
          </div>
          <p className="text-sm text-gray-400 font-mono mt-1">{run.runId}</p>
        </div>
      </div>

      <div className="card p-6 relative overflow-hidden">
        {/* Animated background progress bar */}
        <div 
          className="absolute inset-0 bg-accent-500/5 opacity-0 transition-opacity duration-500" 
          style={{ 
            width: `${progressPercent}%`, 
            opacity: isRunning ? 1 : (isCompleted ? 0.5 : 0) 
          }}
        />
        
        <div className="relative z-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Pipeline Execution Progress</h3>
              <p className="text-sm text-gray-400 mt-1">Pipeline: <span className="text-gray-200">{run.pipelineId?.name || 'Unknown'}</span></p>
            </div>
            
            {isRunning && (
              <Button variant="danger" size="sm">
                <StopCircle size={16} /> Cancel Run
              </Button>
            )}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Processing rows...</span>
              <span className="text-white font-medium">{formatNumber(processed)} / {formatNumber(total)} ({progressPercent}%)</span>
            </div>
            <div className="h-3 w-full bg-base-950 rounded-full overflow-hidden border border-base-800">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  isRunning ? "bg-accent-500 progress-animated" : 
                  isFailed ? "bg-danger-500" : "bg-success-500"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-base-800">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><Database size={14} /> Throughput</span>
              <span className="text-lg font-mono text-white">
                {formatNumber(liveMetrics?.throughput || run.avgThroughput || 0)} <span className="text-sm text-gray-500">rows/s</span>
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success-500" /> Successful</span>
              <span className="text-lg font-mono text-success-400">{formatNumber(successful)}</span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><AlertCircle size={14} className="text-danger-500" /> Failed / Rejected</span>
              <span className="text-lg font-mono text-danger-400">{formatNumber(failed)}</span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><Clock size={14} /> Elapsed Time</span>
              <span className="text-lg font-mono text-white">{formatDuration(duration || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">System Telemetry</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-base-800">
              <span className="text-sm text-gray-400">Peak Memory Usage</span>
              <span className="text-sm font-mono text-white">{formatNumber(liveMetrics?.peakMemoryMb || run.peakMemoryMb || 0)} MB</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-base-800">
              <span className="text-sm text-gray-400">Current Stage</span>
              <span className="text-sm text-white capitalize">{liveMetrics?.stage || run.currentStage}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-base-800">
              <span className="text-sm text-gray-400">Batch Size</span>
              <span className="text-sm font-mono text-white">5,000</span>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Recent Errors</h3>
          {failed > 0 ? (
            <div className="space-y-3">
              {/* Mock error list since we don't have the error API fully hooked up for preview */}
              <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded text-sm text-danger-400 font-mono">
                [Row 421] Type mismatch: expected Integer for 'age', got 'twenty'
              </div>
              <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded text-sm text-danger-400 font-mono">
                [Row 1892] Validation failed: email format invalid 'user@.com'
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-sm text-gray-500">
              No validation errors recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
