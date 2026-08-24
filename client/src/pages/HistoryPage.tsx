import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm' }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="mt-3 text-slate-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition">Cancel</button>
          <button onClick={onConfirm} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 transition">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

interface ImportJob {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

const HistoryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; job: ImportJob | null; force: boolean }>({ isOpen: false, job: null, force: false });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_rows' | 'most_failed'>('newest');

  const currentUploadId = searchParams.get('uploadId') ?? '';

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await api.get('/imports');
        setJobs(response.data.jobs ?? []);
      } catch (err) {
        setError('Unable to load import history.');
      } finally {
        setLoading(false);
      }
    };

    void loadHistory();
  }, []);

  const displayedJobs = useMemo(() => {
    let result = [...jobs];
    
    if (filterStatus !== 'all') {
      result = result.filter((job) => job.status === filterStatus);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((job) => job.fileName.toLowerCase().includes(q));
    }
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'most_rows':
          return b.totalRows - a.totalRows;
        case 'most_failed':
          return b.failedRows - a.failedRows;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    
    return result;
  }, [jobs, filterStatus, searchQuery, sortBy]);

  const totalRows = useMemo(() => jobs.reduce((sum, job) => sum + job.totalRows, 0), [jobs]);
  const latestJob = jobs[0];

  const handleDeleteConfirm = async () => {
    if (!deleteModal.job) return;
    const job = deleteModal.job;
    const forceStr = deleteModal.force ? '?force=true' : '';
    try {
      await api.delete(`/imports/${job.uploadId}${forceStr}`);
      toast.success('Dataset deleted successfully');
      setJobs((prev) => prev.filter((j) => j.uploadId !== job.uploadId));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete dataset';
      if (msg === 'Import not found' && !deleteModal.force) {
        setDeleteModal({ isOpen: true, job, force: true });
        return;
      }
      toast.error(`${msg}`);
    } finally {
      setDeleteModal({ isOpen: false, job: null, force: false });
    }
  };

  return (
    <div className="space-y-8">
      <ConfirmModal 
        isOpen={deleteModal.isOpen} 
        title={deleteModal.force ? 'Force Delete?' : 'Delete Dataset'} 
        message={deleteModal.force ? 'Import not found for your account. Try force-delete as admin?' : `Are you sure you want to delete ${deleteModal.job?.fileName}? This will remove all related data.`}
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ isOpen: false, job: null, force: false })}
      />
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Import history</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Track every dataset import.</h1>
            <p className="mt-4 text-slate-400">Review the timeline of ingestion jobs, status, and row counts with enterprise-level audit visibility.</p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Clean, high-end history analytics</div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-cyan-500">
          <p className="text-sm text-slate-400">Import jobs</p>
          <p className="mt-3 text-3xl font-semibold text-white">{jobs.length}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-400">Rows ingested</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalRows.toLocaleString()}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-indigo-500">
          <p className="text-sm text-slate-400">Last updated</p>
          <p className="mt-3 text-3xl font-semibold text-white">{latestJob ? new Date(latestJob.createdAt).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/80 p-16 shadow-2xl backdrop-blur-xl">
          <svg className="h-10 w-10 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="mt-4 text-lg font-medium text-slate-300">Loading history...</p>
        </div>
      )}
      {error && <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/5 p-8 text-rose-300 shadow-lg text-center backdrop-blur-xl">⚠️ {error}</div>}

      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-16 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/80 text-4xl shadow-inner">📂</div>
          <h3 className="mt-5 text-2xl font-semibold text-white">No history found</h3>
          <p className="mt-3 text-slate-400">Upload your first dataset to start building your import history timeline.</p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[28px] border border-white/10 bg-slate-900/80 p-5 shadow-lg">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search datasets..."
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
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
              </select>
            </div>
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400 transition"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="most_rows">Most rows</option>
                <option value="most_failed">Most failed rows</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
            <div className="grid min-w-full grid-cols-[1.5fr_1fr_1fr_1fr_1fr_0.9fr] gap-4 border-b border-white/10 bg-slate-950/80 px-8 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
              <div>Dataset</div>
              <div>Status</div>
              <div>Rows</div>
              <div>Failed</div>
              <div>Started</div>
              <div>Action</div>
            </div>
            <div className="max-h-[560px] overflow-auto p-4 space-y-2">
              {displayedJobs.map((job) => (
              <div
                key={job.uploadId}
                className={`grid min-w-full grid-cols-[1.5fr_1fr_1fr_1fr_1fr_0.9fr] items-center gap-4 py-3 px-4 text-sm text-slate-200 rounded-2xl border transition-colors hover:bg-white/5 ${job.uploadId === currentUploadId ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-slate-950/50 border-white/5'}`}
              >
                <div className="truncate font-medium text-white">{job.fileName}</div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : job.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {job.status === 'completed' ? '✅ Completed' : job.status === 'failed' ? '🔴 Failed' : '⏳ Pending'}
                  </span>
                </div>
                <div className="font-mono text-slate-300">{job.totalRows.toLocaleString()}</div>
                <div className="font-mono text-slate-300">{job.failedRows.toLocaleString()}</div>
                <div className="text-slate-400">{job.startedAt ? new Date(job.startedAt).toLocaleDateString() : '—'}</div>
                <div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/validations?uploadId=${job.uploadId}`)}
                      className="rounded-full border border-white/10 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                    >
                      Inspect
                    </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/audit?uploadId=${job.uploadId}`)}
                        className="rounded-full border border-white/10 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                      >
                        Audit
                      </button>
                    {job.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => window.open(`/api/imports/${job.uploadId}/download?type=processed`, '_blank')}
                        className="rounded-full border border-white/10 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                      >
                        Export
                      </button>
                    )}
                    {job.failedRows > 0 && (
                      <button
                        type="button"
                        onClick={() => window.open(`/api/imports/${job.uploadId}/download?type=failed`, '_blank')}
                        className="rounded-full border border-white/10 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                      >
                        Failed Rows
                      </button>
                    )}
                      <button
                        type="button"
                        onClick={() => setDeleteModal({ isOpen: true, job, force: false })}
                        className="rounded-full border border-white/10 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                      >
                        Remove
                      </button>
                  </div>
                </div>
              </div>
            ))}
            {displayedJobs.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 shadow-inner mb-4 text-2xl">🔍</div>
                No imports match your current filters.
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
