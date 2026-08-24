import { useEffect, useState } from 'react';
import api from '../services/api';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await api.get('/dashboard/metrics');
        setMetrics(response.data.summary);
      } catch (err) {
        setError('Unable to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    };

    void loadMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-10 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Dashboard</p>
              <h1 className="mt-2 text-4xl font-semibold text-white">Enterprise ETL command center</h1>
              <p className="mt-4 max-w-2xl text-base text-slate-400">
                Monitor imports, surface issues quickly, and keep your pipeline running smoothly with clear insights and fast actions.
              </p>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              All systems operational
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-lg border-l-4 border-l-cyan-500 transition hover:bg-slate-900">
                <p className="text-sm text-slate-400">Total imports</p>
                <p className="mt-3 text-3xl font-semibold text-white">{metrics?.totalJobs ?? '—'}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-lg border-l-4 border-l-emerald-500 transition hover:bg-slate-900">
                <p className="text-sm text-slate-400">Rows processed</p>
                <p className="mt-3 text-3xl font-semibold text-white">{metrics?.totalRows?.toLocaleString() ?? '—'}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-lg border-l-4 border-l-rose-500 transition hover:bg-slate-900">
                <p className="text-sm text-slate-400">Failed imports</p>
                <p className="mt-3 text-3xl font-semibold text-white">{metrics?.failedJobs ?? '—'}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-lg border-l-4 border-l-indigo-500 transition hover:bg-slate-900">
                <p className="text-sm text-slate-400">New upload</p>
                <button onClick={() => window.location.assign('/upload')} className="mt-3 w-full rounded-full bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                  Start upload
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Quick insight</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Latest import summary</h2>
            <div className="mt-6 flex flex-wrap gap-4">
              <div className="min-w-[148px] rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Average latency</p>
                <p className="mt-3 text-3xl font-semibold text-white">1.2s</p>
              </div>
              <div className="min-w-[148px] rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Failure alerts</p>
                <p className="mt-3 text-3xl font-semibold text-white">2</p>
              </div>
            </div>
            <div className="mt-8 rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-400">System status</p>
                  <p className="mt-2 text-xl font-semibold text-white">Metrics loaded</p>
                </div>
                {loading ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Loading
                  </span>
                ) : error ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-1.5 text-sm font-medium text-rose-400">
                    ⚠️ {error}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> Ready
                  </span>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
                  <p className="text-sm text-slate-400">Completed jobs</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics?.completedJobs ?? '—'}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
                  <p className="text-sm text-slate-400">Total failed rows</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics?.totalFailedRows?.toLocaleString() ?? '—'}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
                  <p className="text-sm text-slate-400">Running jobs</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metrics?.runningJobs ?? '0'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
