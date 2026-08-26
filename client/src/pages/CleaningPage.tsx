import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import ErrorAlert, { extractErrorMessage } from '../components/ErrorAlert';

type MissingColumnSummary = {
  name: string;
  totalRows: number;
  missingValues: number;
  missingPercentage: number;
  completeCount: number;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  sampleValues: unknown[];
};

type MissingDataSummary = {
  totalRows: number;
  rowsWithMissingData: number;
  completeRows: number;
  totalMissingValues: number;
  missingPercentage: number;
};

type StrategyChoice = 'keep' | 'remove' | 'fill' | 'mean' | 'median' | 'mode';

type ColumnStrategy = {
  strategy: StrategyChoice;
  fillValue: string;
};

const strategyLabels: Record<StrategyChoice, string> = {
  keep: 'Keep missing values',
  remove: 'Remove rows',
  fill: 'Fill manually',
  mean: 'Fill mean',
  median: 'Fill median',
  mode: 'Fill mode'
};

const CleaningPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [uploadId, setUploadId] = useState('');
  const [importJobs, setImportJobs] = useState<Array<{ uploadId: string; fileName: string; status: string }>>([]);
  const [columns, setColumns] = useState<MissingColumnSummary[]>([]);
  const [summary, setSummary] = useState<MissingDataSummary | null>(null);
  const [strategies, setStrategies] = useState<Record<string, ColumnStrategy>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const [showAllColumns, setShowAllColumns] = useState(false);

  useEffect(() => {
    const loadImportJobs = async () => {
      try {
        const response = await api.get('/imports');
        setImportJobs(response.data.jobs ?? []);
      } catch {
        // Ignore import history failures.
      }
    };

    void loadImportJobs();
  }, []);

  useEffect(() => {
    const idFromQuery = searchParams.get('uploadId') ?? '';
    setUploadId(idFromQuery);
  }, [searchParams]);

  useEffect(() => {
    const loadMissingSummary = async () => {
      if (!uploadId) {
        setColumns([]);
        setStrategies({});
        setLoading(false);
        return;
      }

      setError('');
      setMessage('');
      setLoading(true);

      try {
        const response = await api.get('/cleaning', { params: { uploadId } });
        const fetchedColumns: MissingColumnSummary[] = response.data.columns ?? [];
        const fetchedSummary: MissingDataSummary | null = response.data.summary ?? null;
        setColumns(fetchedColumns);
        setSummary(fetchedSummary);

        const initialStrategies = fetchedColumns.reduce((acc, column) => {
          acc[column.name] = { strategy: 'keep', fillValue: '' };
          return acc;
        }, {} as Record<string, ColumnStrategy>);
        setStrategies(initialStrategies);

        if (!fetchedColumns.length && !fetchedSummary) {
          setError('No missing data summary is available for this upload.');
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Unable to load missing data summary.'));
      } finally {
        setLoading(false);
      }
    };

    void loadMissingSummary();
  }, [uploadId]);

  const handleStrategyChange = (column: string, strategy: StrategyChoice) => {
    setStrategies((current) => ({
      ...current,
      [column]: { ...current[column], strategy }
    }));
  };

  const handleFillValueChange = (column: string, fillValue: string) => {
    setStrategies((current) => ({
      ...current,
      [column]: { ...current[column], fillValue }
    }));
  };

  const handleSelectDataset = (value: string) => {
    if (!value) return;
    navigate(`/cleaning?uploadId=${value}`);
  };

  const applyStrategy = async (column: string) => {
    if (!uploadId) return;
    const current = strategies[column];
    if (!current) return;

    if (current.strategy === 'fill' && !current.fillValue.trim()) {
      setError('Please enter a fill value before applying the strategy.');
      return;
    }

    setError('');
    setMessage('');
    setApplying(column);

    try {
      await api.post('/cleaning', {
        uploadId,
        column,
        strategy: current.strategy,
        fillValue: current.strategy === 'fill' ? current.fillValue : undefined
      });
      setMessage(`Applied ${strategyLabels[current.strategy]} to ${column}.`);
      const response = await api.get('/cleaning', { params: { uploadId } });
      const refreshed = response.data.columns ?? [];
      const refreshedSummary: MissingDataSummary | null = response.data.summary ?? null;
      setColumns(refreshed);
      setSummary(refreshedSummary);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to apply cleaning strategies.'));
      setMessage('');
    } finally {
      setApplying('');
    }
  };

  const applyAll = async () => {
    for (const column of columns.map((column) => column.name)) {
      const strategy = strategies[column]?.strategy ?? 'keep';
      if (strategy === 'keep') continue;
      await applyStrategy(column);
    }
  };

  const missingSummary = useMemo(() => {
    if (!summary) {
      return {
        totalRows: 0,
        rowsWithMissingData: 0,
        completeRows: 0,
        totalMissingValues: 0,
        missingPercentage: 0,
        totalColumns: columns.length
      };
    }

    return {
      ...summary,
      totalColumns: columns.length
    };
  }, [summary, columns.length]);

  const visibleColumns = useMemo(
    () => columns
      .filter((column) => showAllColumns || column.missingValues > 0)
      .filter((column) => column.name.toLowerCase().includes(fieldSearch.toLowerCase())),
    [columns, showAllColumns, fieldSearch]
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Data cleaning</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Resolve missing values before mapping.</h1>
            <p className="mt-4 text-slate-400">Choose keep, remove, or smart fill strategies to prepare your dataset for reliable transformation and downstream analytics.</p>
          </div>
        </div>
      </section>

      <div className="mt-4">
        <label htmlFor="datasetSelect" className="block text-sm font-medium text-slate-300">Select dataset</label>
        <div className="mt-2 flex gap-2">
          <select
            id="datasetSelect"
            value={uploadId}
            onChange={(event) => handleSelectDataset(event.target.value)}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
          >
            <option value="">Choose a dataset</option>
            {importJobs.map((job) => (
              <option key={job.uploadId} value={job.uploadId}>
                {job.fileName} {job.status !== 'completed' ? `(${job.status})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleSelectDataset(uploadId)}
            disabled={!uploadId}
            className="rounded-full border border-white/10 bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load dataset
          </button>
        </div>
      </div>

      {!uploadId && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">Please select a dataset to continue.</p>
          <p className="mt-3 text-slate-400">Select an existing dataset from the dropdown above or import a new file to clean missing values before mapping.</p>
          <button onClick={() => navigate('/upload')} className="mt-6 rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Go to upload</button>
        </div>
      )}

      {loading && uploadId && (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/80 p-16 shadow-2xl backdrop-blur-xl">
          <svg className="h-10 w-10 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="mt-4 text-lg font-medium text-slate-300">Analyzing dataset...</p>
        </div>
      )}
      
      {error && <ErrorAlert message={error} onRetry={() => window.location.reload()} />}
      {message && (
        <div className="flex items-center gap-3 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-300 shadow-lg">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xl shadow-inner">✨</div>
          <p className="font-medium">{message}</p>
        </div>
      )}

      {!loading && uploadId && columns.length === 0 && !error && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-white font-semibold">No missing values detected</p>
              <p className="mt-2 text-slate-400">Your dataset is clean and ready for mapping.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/mapping?uploadId=${uploadId}`)}
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 whitespace-nowrap"
            >
              Continue to mapping →
            </button>
          </div>
        </div>
      )}

      {!loading && uploadId && columns.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Data quality summary</p>
                <p className="mt-2 text-slate-400">Overview of missing values and dataset readiness before mapping.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Total rows</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.totalRows.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Rows with missing data</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.rowsWithMissingData.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Complete rows</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.completeRows.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Total missing values</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.totalMissingValues.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Missing data rate</p>
                <p className="mt-3 text-2xl font-semibold text-white">{missingSummary.missingPercentage.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Fields requiring attention</p>
                <p className="mt-2 text-sm text-slate-300">Only columns with missing values are shown by default.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[220px]">
                  <input
                    type="search"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllColumns((current) => !current)}
                  className="rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 transition hover:bg-slate-900"
                >
                  {showAllColumns ? 'Show only missing' : 'Show all columns'}
                </button>
              </div>
            </div>

            <div className="grid min-w-full grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1.6fr_1.4fr] gap-4 border-b border-white/10 bg-slate-950/80 px-8 py-4 text-sm uppercase tracking-[0.18em] text-slate-400">
              <div>Field</div>
              <div>Missing</div>
              <div>Rate</div>
              <div>Type</div>
              <div>Sample values</div>
              <div>Resolution Rule</div>
            </div>
            <div className="max-h-[560px] overflow-auto p-4 space-y-2">
              {visibleColumns.map((column) => {
                const current = strategies[column.name] ?? { strategy: 'keep', fillValue: '' };
                const isConfigured = current.strategy !== 'keep';
                const isApplying = applying === column.name;

                return (
                  <div key={column.name} className={`grid min-w-full grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1.6fr_1.4fr] items-center gap-4 px-4 py-3 text-sm text-slate-200 rounded-2xl border transition-colors ${isConfigured ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-slate-950/50 border-white/5 hover:bg-white/5'}`}>
                    <div className="font-medium text-white flex items-center gap-2">
                      {isApplying && <svg className="h-4 w-4 animate-spin text-cyan-500 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                      {column.name}
                    </div>
                    <div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${column.missingValues > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {column.missingValues.toLocaleString()}
                      </span>
                    </div>
                    <div className={column.missingPercentage > 0 ? 'text-amber-400' : 'text-slate-400'}>{column.missingPercentage.toFixed(1)}%</div>
                    <div>{column.type}</div>
                    <div className="truncate text-slate-400" title={column.sampleValues.join(', ')}>
                      {column.sampleValues.slice(0, 3).map((value, idx) => <span key={idx}>{String(value)}{idx < column.sampleValues.length - 1 ? ', ' : ''}</span>)}
                    </div>
                    <div className="space-y-2">
                      <select
                        value={current.strategy}
                        onChange={(e) => handleStrategyChange(column.name, e.target.value as StrategyChoice)}
                        className={`w-full rounded-2xl border px-3 py-2 text-sm outline-none transition ${isConfigured ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 focus:border-cyan-400' : 'bg-slate-900/80 border-white/10 text-slate-400 focus:border-cyan-400'}`}
                      >
                        {Object.entries(strategyLabels).map(([value, label]) => (
                          <option key={value} value={value}>{value === 'keep' ? 'Ignore (No rule)' : label}</option>
                        ))}
                      </select>
                      {current.strategy === 'fill' && (
                        <input
                          type="text"
                          value={current.fillValue}
                          onChange={(event) => handleFillValueChange(column.name, event.target.value)}
                          placeholder="Fill value"
                          className="w-full rounded-2xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleColumns.length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-slate-400">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 shadow-inner mb-4 text-2xl">✨</div>
                  No columns match the filter. Your data is clean!
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applyAll}
              disabled={columns.filter((col) => strategies[col.name]?.strategy !== 'keep').length === 0 || Boolean(applying)}
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {applying ? 'Applying…' : columns.filter((col) => strategies[col.name]?.strategy !== 'keep').length > 0 ? `Apply ${columns.filter((col) => strategies[col.name]?.strategy !== 'keep').length} Selected Strategies` : 'No Rules Configured'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/mapping?uploadId=${uploadId}`)}
              className="rounded-full border border-white/10 bg-slate-950/90 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Continue to mapping →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningPage;
