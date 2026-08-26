import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import ErrorAlert, { extractErrorMessage } from '../components/ErrorAlert';

const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="mt-3 text-slate-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 transition"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ImportJob {
  uploadId: string;
  fileName: string;
  original_filename?: string;
  status: string;
  totalRows?: number;
  row_count?: number;
  processed_rows?: number;
  failedRows?: number;
  failed_rows?: number;
  columns?: string[];
  columnCount?: number;
  column_count?: number;
  startedAt?: string;
  finishedAt?: string;
  created_at?: string;
  createdAt?: string;
}

const getFileName = (job: ImportJob): string => {
  if (job.original_filename) return job.original_filename;
  if (job.fileName) {
    // If backend formatted fileName as "original.csv (8/26/2026, 11:00:00 AM)", extract the original name
    const match = job.fileName.match(/^(.*?)(?:\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}.*?\))?$/);
    if (match && match[1].trim()) return match[1].trim();
    return job.fileName;
  }
  return job.uploadId || 'Untitled Dataset';
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return { date: '—', time: '—', full: '—' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: String(dateStr), time: '', full: String(dateStr) };
  return {
    date: d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    full: d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
};

const getRowCount = (job: ImportJob): number => {
  return job.totalRows ?? job.row_count ?? job.processed_rows ?? 0;
};

const getFailedRows = (job: ImportJob): number => {
  return job.failedRows ?? job.failed_rows ?? 0;
};

const getColumnCount = (job: ImportJob): number | null => {
  if (typeof job.columnCount === 'number') return job.columnCount;
  if (typeof job.column_count === 'number') return job.column_count;
  if (Array.isArray(job.columns) && job.columns.length > 0) return job.columns.length;
  return null;
};

const getStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'completed':
      return {
        label: 'Completed',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-400',
      };
    case 'processing':
      return {
        label: 'Processing',
        badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        dotClass: 'bg-cyan-400 animate-pulse',
      };
    case 'uploaded':
      return {
        label: 'Uploaded',
        badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        dotClass: 'bg-sky-400',
      };
    case 'mapped':
      return {
        label: 'Mapped',
        badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        dotClass: 'bg-indigo-400',
      };
    case 'failed':
      return {
        label: 'Failed',
        badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-400',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        dotClass: 'bg-slate-400',
      };
    case 'pending':
    default:
      return {
        label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending',
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-400',
      };
  }
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; job: ImportJob | null; force: boolean }>({
    isOpen: false,
    job: null,
    force: false,
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_rows' | 'most_cols' | 'most_failed'>('newest');

  const currentUploadId = searchParams.get('uploadId') ?? '';

  const resolveColumnCounts = useCallback(async (pendingJobs: ImportJob[]) => {
    const updates: Record<string, number> = {};
    await Promise.allSettled(
      pendingJobs.map(async (job) => {
        try {
          const res = await api.get(`/imports/${job.uploadId}`);
          const jobData = res.data?.job;
          let count: number | undefined = undefined;
          if (Array.isArray(jobData?.selectedColumns) && jobData.selectedColumns.length > 0) {
            count = jobData.selectedColumns.length;
          } else if (Array.isArray(jobData?.mapping) && jobData.mapping.length > 0) {
            count = jobData.mapping.length;
          }
          if (count === undefined) {
            const prevRes = await api.get(`/imports/${job.uploadId}/preview?type=source`);
            if (Array.isArray(prevRes.data?.columns) && prevRes.data.columns.length > 0) {
              count = prevRes.data.columns.length;
            }
          }
          if (typeof count === 'number') {
            updates[job.uploadId] = count;
          }
        } catch {
          // Ignore errors during auxiliary column count fetch
        }
      })
    );

    if (Object.keys(updates).length > 0) {
      setJobs((prev) =>
        prev.map((job) => {
          if (updates[job.uploadId] !== undefined) {
            return { ...job, columnCount: updates[job.uploadId] };
          }
          return job;
        })
      );
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/imports');
      const rawJobs: any[] = response.data?.jobs ?? [];

      const normalized: ImportJob[] = rawJobs.map((j) => ({
        ...j,
        uploadId: j.uploadId || j.id,
        fileName: j.fileName || j.original_filename || 'Untitled Dataset',
        original_filename: j.original_filename,
        status: j.status || 'pending',
        totalRows: j.totalRows ?? j.row_count ?? j.processed_rows ?? 0,
        failedRows: j.failedRows ?? j.failed_rows ?? 0,
        columnCount: j.columnCount ?? j.column_count ?? (Array.isArray(j.columns) ? j.columns.length : undefined),
        createdAt: j.createdAt || j.created_at || j.startedAt || new Date().toISOString(),
        created_at: j.created_at || j.createdAt,
      }));

      setJobs(normalized);

      // Asynchronously resolve column count if not present
      const jobsNeedingColCount = normalized.filter(
        (job) => job.columnCount === undefined && (!job.columns || job.columns.length === 0)
      );

      if (jobsNeedingColCount.length > 0) {
        void resolveColumnCounts(jobsNeedingColCount);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load import history.'));
    } finally {
      setLoading(false);
    }
  }, [resolveColumnCounts]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const displayedJobs = useMemo(() => {
    let result = [...jobs];

    if (filterStatus !== 'all') {
      result = result.filter((job) => job.status.toLowerCase() === filterStatus.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((job) => {
        const name = getFileName(job).toLowerCase();
        const uploadId = (job.uploadId || '').toLowerCase();
        const status = (job.status || '').toLowerCase();
        return name.includes(q) || uploadId.includes(q) || status.includes(q);
      });
    }

    result.sort((a, b) => {
      const aDate = new Date(a.created_at || a.createdAt || a.startedAt || 0).getTime();
      const bDate = new Date(b.created_at || b.createdAt || b.startedAt || 0).getTime();
      const aRows = getRowCount(a);
      const bRows = getRowCount(b);
      const aCols = getColumnCount(a) ?? 0;
      const bCols = getColumnCount(b) ?? 0;
      const aFailed = getFailedRows(a);
      const bFailed = getFailedRows(b);

      switch (sortBy) {
        case 'oldest':
          return aDate - bDate;
        case 'most_rows':
          return bRows - aRows;
        case 'most_cols':
          return bCols - aCols;
        case 'most_failed':
          return bFailed - aFailed;
        case 'newest':
        default:
          return bDate - aDate;
      }
    });

    return result;
  }, [jobs, filterStatus, searchQuery, sortBy]);

  const totalRows = useMemo(
    () => jobs.reduce((sum, job) => sum + getRowCount(job), 0),
    [jobs]
  );

  const totalCols = useMemo(() => {
    const counts = jobs
      .map((j) => getColumnCount(j))
      .filter((c): c is number => typeof c === 'number');
    return counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : null;
  }, [jobs]);

  const latestJob = jobs[0];
  const latestDateTime = latestJob
    ? formatDateTime(latestJob.created_at || latestJob.createdAt || latestJob.startedAt)
    : null;

  const handleDeleteConfirm = async () => {
    if (!deleteModal.job) return;
    const job = deleteModal.job;
    const forceStr = deleteModal.force ? '?force=true' : '';
    try {
      await api.delete(`/imports/${job.uploadId}${forceStr}`);
      toast.success('Dataset deleted successfully');
      setJobs((prev) => prev.filter((j) => j.uploadId !== job.uploadId));
    } catch (err: any) {
      const msg = extractErrorMessage(err, 'Failed to delete dataset');
      if (msg === 'Import not found' && !deleteModal.force) {
        setDeleteModal({ isOpen: true, job, force: true });
        return;
      }
      toast.error(msg);
    } finally {
      setDeleteModal({ isOpen: false, job: null, force: false });
    }
  };

  return (
    <div className="space-y-8">
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.force ? 'Force Delete?' : 'Delete Dataset'}
        message={
          deleteModal.force
            ? 'Import not found for your account. Try force-delete as admin?'
            : `Are you sure you want to delete ${getFileName(deleteModal.job || { uploadId: '', fileName: '', status: '' })}? This will remove all related data.`
        }
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ isOpen: false, job: null, force: false })}
      />

      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Import history</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Track every dataset import.</h1>
            <p className="mt-4 text-slate-400">
              Review ingestion timeline, status, row counts, and column schemas with enterprise-level audit visibility.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            Clean, high-end history analytics
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-cyan-500">
          <p className="text-sm text-slate-400">Import jobs</p>
          <p className="mt-3 text-3xl font-semibold text-white">{jobs.length}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-400">Rows ingested</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalRows.toLocaleString()}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-indigo-500">
          <p className="text-sm text-slate-400">Avg. columns</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalCols !== null ? totalCols : '—'}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-purple-500">
          <p className="text-sm text-slate-400">Last updated</p>
          <p className="mt-3 text-xl font-semibold text-white truncate" title={latestDateTime?.full ?? '—'}>
            {latestDateTime ? latestDateTime.date : '—'}
          </p>
          {latestDateTime && latestDateTime.time !== '—' && (
            <p className="text-xs text-slate-400 mt-1">{latestDateTime.time}</p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/80 p-16 shadow-2xl backdrop-blur-xl">
          <svg className="h-10 w-10 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg font-medium text-slate-300">Loading history...</p>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={() => void loadHistory()} />}

      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-16 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/80 text-4xl shadow-inner">
            📂
          </div>
          <h3 className="mt-5 text-2xl font-semibold text-white">No history found</h3>
          <p className="mt-3 text-slate-400">Upload your first dataset to start building your import history timeline.</p>
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Upload Dataset
          </button>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[28px] border border-white/10 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search by filename or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400 transition"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400 transition"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="uploaded">Uploaded</option>
                <option value="mapped">Mapped</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400 transition"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="most_rows">Most rows</option>
                <option value="most_cols">Most columns</option>
                <option value="most_failed">Most failed rows</option>
              </select>
              <button
                type="button"
                onClick={() => void loadHistory()}
                disabled={loading}
                className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:border-cyan-400/50 transition flex items-center gap-1.5"
                title="Refresh history"
              >
                <svg
                  className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                <div className="grid grid-cols-[1.8fr_1.3fr_1fr_1fr_0.9fr_1.6fr] gap-4 border-b border-white/10 bg-slate-950/80 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <div>Filename</div>
                  <div>Upload Date / Time</div>
                  <div>Status</div>
                  <div>Row Count</div>
                  <div>Column Count</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="max-h-[560px] overflow-y-auto p-4 space-y-2">
                  {displayedJobs.map((job) => {
                    const fileName = getFileName(job);
                    const uploadInfo = formatDateTime(job.created_at || job.createdAt || job.startedAt);
                    const statusBadge = getStatusBadge(job.status);
                    const rowCount = getRowCount(job);
                    const failedRows = getFailedRows(job);
                    const colCount = getColumnCount(job);

                    return (
                      <div
                        key={job.uploadId}
                        className={`grid grid-cols-[1.8fr_1.3fr_1fr_1fr_0.9fr_1.6fr] items-center gap-4 py-3.5 px-6 text-sm text-slate-200 rounded-2xl border transition-colors hover:bg-white/5 ${
                          job.uploadId === currentUploadId
                            ? 'bg-cyan-500/10 border-cyan-500/30 ring-1 ring-cyan-500/20'
                            : 'bg-slate-950/50 border-white/5'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 text-sm flex-shrink-0">📄</span>
                            <span className="truncate font-semibold text-white text-sm" title={fileName}>
                              {fileName}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400" title={job.uploadId}>
                            ID: {job.uploadId}
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-200 font-medium text-xs sm:text-sm">{uploadInfo.date}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{uploadInfo.time}</div>
                        </div>

                        <div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${statusBadge.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dotClass}`} />
                            {statusBadge.label}
                          </span>
                        </div>

                        <div>
                          <div className="font-mono font-medium text-white">{rowCount.toLocaleString()}</div>
                          {failedRows > 0 ? (
                            <div className="text-[11px] text-rose-400 font-mono mt-0.5">
                              {failedRows.toLocaleString()} failed
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 mt-0.5">0 errors</div>
                          )}
                        </div>

                        <div>
                          {colCount !== null ? (
                            <div className="font-mono font-medium text-white">
                              {colCount} <span className="text-slate-400 text-xs font-normal">cols</span>
                            </div>
                          ) : (
                            <div className="text-slate-400 text-xs flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                              <span>Loading...</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/validations?uploadId=${job.uploadId}`)}
                              title="Inspect validation issues"
                              className="rounded-full border border-white/10 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/audit?uploadId=${job.uploadId}`)}
                              title="Audit dataset memory and performance"
                              className="rounded-full border border-white/10 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                            >
                              Audit
                            </button>
                            {job.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() =>
                                  window.open(`/api/imports/${job.uploadId}/download?type=processed`, '_blank')
                                }
                                title="Export processed data"
                                className="rounded-full border border-white/10 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                              >
                                Export
                              </button>
                            )}
                            {failedRows > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  window.open(`/api/imports/${job.uploadId}/download?type=failed`, '_blank')
                                }
                                title="Download failed rows CSV"
                                className="rounded-full border border-white/10 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                              >
                                Failed Rows
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteModal({ isOpen: true, job, force: false })}
                              title="Delete dataset"
                              className="rounded-full border border-white/10 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {displayedJobs.length === 0 && (
                    <div className="px-4 py-12 text-center text-sm text-slate-400">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 shadow-inner mb-4 text-2xl">
                        🔍
                      </div>
                      No imports match your current filters.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
