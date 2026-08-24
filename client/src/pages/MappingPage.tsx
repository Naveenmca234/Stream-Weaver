import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import ErrorAlert, { extractErrorMessage } from '../components/ErrorAlert';

type MappingRow = {
  source: string;
  target: string;
  selected?: boolean;
  transformCode?: string;
  autoClean?: string;
};

interface ImportJobSummary {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  createdAt?: string;
  columns?: string[];
  selectedColumns?: string[];
}

const buildMappingRows = (mapping: unknown, sourceColumns: string[]): MappingRow[] => {
  const rowsBySource = new Map<string, MappingRow>();

  if (Array.isArray(mapping)) {
    for (const item of mapping) {
      if (!item || typeof item !== 'object') continue;
      const source = (item as any).source;
      const target = (item as any).dest ?? (item as any).target;
      if (typeof source !== 'string' || typeof target !== 'string' || !target.trim()) continue;
      rowsBySource.set(source, {
        source,
        target,
        selected: true,
        transformCode: typeof (item as any).transformCode === 'string' ? (item as any).transformCode : undefined,
        autoClean: typeof (item as any).autoClean === 'string' ? (item as any).autoClean : undefined
      });
    }
  } else if (mapping && typeof mapping === 'object') {
    for (const [dest, value] of Object.entries(mapping as Record<string, unknown>)) {
      if (!dest.trim()) continue;
      if (typeof value === 'string') {
        rowsBySource.set(value, { source: value, target: dest, selected: true, transformCode: undefined });
      } else if (value && typeof value === 'object' && typeof (value as any).source === 'string') {
        rowsBySource.set((value as any).source, {
          source: (value as any).source,
          target: dest,
          selected: true,
          transformCode: typeof (value as any).transformCode === 'string' ? (value as any).transformCode : undefined,
          autoClean: typeof (value as any).autoClean === 'string' ? (value as any).autoClean : undefined
        });
      }
    }
  }

  const rows = sourceColumns.map((source) => rowsBySource.get(source) ?? { source, target: '', selected: false, transformCode: undefined });
  for (const row of rowsBySource.values()) {
    if (!sourceColumns.includes(row.source)) {
      rows.push(row);
    }
  }

  return rows;
};

const normalizeMapping = (raw: unknown): Record<string, { source: string; transformCode?: string }> => {
  const mapping: Record<string, { source: string; transformCode?: string }> = {};

  if (!raw || typeof raw !== 'object') return mapping;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const source = (item as any).source;
      const target = (item as any).dest ?? (item as any).target;
      if (typeof source !== 'string' || !source.trim() || typeof target !== 'string' || !target.trim()) continue;
      mapping[target.trim()] = {
        source: source.trim(),
        transformCode: typeof (item as any).transformCode === 'string' ? (item as any).transformCode : undefined
      };
    }
  } else {
    for (const [dest, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!dest.trim()) continue;
      if (typeof value === 'string') {
        mapping[dest.trim()] = { source: value.trim() };
      } else if (value && typeof value === 'object' && typeof (value as any).source === 'string') {
        mapping[dest.trim()] = {
          source: (value as any).source.trim(),
          transformCode: typeof (value as any).transformCode === 'string' ? (value as any).transformCode : undefined
        };
      }
    }
  }

  return mapping;
};

const MappingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [dataProfile, setDataProfile] = useState<Record<string, any> | null>(null);
  const [profiling, setProfiling] = useState(false);
  
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const response = await api.get('/workflows');
        setWorkflows(response.data.workflows ?? []);
      } catch {
        // ignore
      }
    };
    void loadWorkflows();
  }, []);

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
    const loadImportData = async () => {
      const idFromQuery = searchParams.get('uploadId') ?? '';
      setUploadId(idFromQuery);

      if (!idFromQuery) {
        setPreview([]);
        setSourceColumns([]);
        setMappingRows([]);
        setError('');
        setLoading(false);
        return;
      }

      setError('');
      setLoading(true);

      try {
        const [previewResponse, mappingResponse] = await Promise.all([
          api.get(`/imports/${idFromQuery}/preview?type=source`),
          api.get(`/imports/${idFromQuery}`)
        ]);

        // Load profile asynchronously in background
        setProfiling(true);
        api.get(`/imports/${idFromQuery}/profile`)
          .then(res => setDataProfile(res.data.profile))
          .catch(() => setDataProfile(null))
          .finally(() => setProfiling(false));

        const uploadedPreview = (previewResponse.data.rows ?? []);
        setPreview(uploadedPreview);

        const jobColumns = mappingResponse.data.job?.columns as string[] | undefined;
        const selectedColumnsFromJob = mappingResponse.data.job?.selectedColumns as string[] | undefined;
        const debugColumns = previewResponse.data.columns as string[] | undefined;
        const derivedColumns: string[] = Array.from(new Set(uploadedPreview.flatMap(Object.keys)));

        const chosenColumns = selectedColumnsFromJob && selectedColumnsFromJob.length
          ? selectedColumnsFromJob
          : jobColumns && jobColumns.length
            ? jobColumns
            : debugColumns && debugColumns.length
              ? debugColumns
              : derivedColumns;

        setSourceColumns(chosenColumns);

        const mappingFromJob = mappingResponse.data.job?.mapping;
        const rows = buildMappingRows(mappingFromJob, chosenColumns);
        setMappingRows(rows);
      } catch (err) {
        console.error('Failed to fetch mapping dependencies:', err);
        setError(extractErrorMessage(err, 'Unable to load import mapping data.'));
      } finally {
        setLoading(false);
      }
    };

    void loadImportData();
  }, [searchParams]);

  useEffect(() => {
    setSearchFilter('');
    setExpandedRows({});
  }, [uploadId]);

  const availableSourceFields = useMemo(() => sourceColumns.length ? sourceColumns : Array.from(new Set(preview.flatMap(Object.keys))), [preview, sourceColumns]);
  const sampleRow = preview[0] ?? {};
  const selectedJob = importJobs.find((job) => job.uploadId === uploadId);
  const oneDatasetAvailable = importJobs.length === 1;
  
  // Calculate isAllSelected and isSomeSelected based on mappingRows first
  const isAllSelectedValue = mappingRows.filter((row) => row.selected).length === mappingRows.length && mappingRows.length > 0;
  const isSomeSelectedValue = mappingRows.some((row) => row.selected);
  
  const visibleRows = useMemo(
    () => mappingRows
      .map((row, rowIndex) => ({ ...row, rowIndex }))
      .filter((row) => row.source.toLowerCase().includes(searchFilter.toLowerCase())),
    [mappingRows, searchFilter]
  );
  
  const isAllSelected = visibleRows.length > 0 && visibleRows.every((row) => row.selected);
  const isSomeSelected = visibleRows.some((row) => row.selected);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeSelected && !isAllSelected;
    }
  }, [isAllSelected, isSomeSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const visibleSources = new Set(visibleRows.map((row) => row.source));
      setMappingRows((current) =>
        current.map((row) => (visibleSources.has(row.source) ? { ...row, selected: false } : row))
      );
    } else {
      const visibleSources = new Set(visibleRows.map((row) => row.source));
      setMappingRows((current) =>
        current.map((row) => (visibleSources.has(row.source) ? { ...row, selected: true, target: row.target || row.source } : row))
      );
    }
  };

  const targetOptions = useMemo(() => {
    const targets = new Set<string>();
    mappingRows.forEach((row) => {
      if (row.selected && row.target?.trim()) targets.add(row.target.trim());
    });
    availableSourceFields.forEach((field) => targets.add(field));
    return Array.from(targets).sort((a, b) => a.localeCompare(b));
  }, [availableSourceFields, mappingRows]);

  const selectedTargets = useMemo(
    () => new Set(mappingRows.filter((row) => row.selected && row.target.trim()).map((row) => row.target.trim())),
    [mappingRows]
  );

  const mappedValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    mappingRows.forEach(({ source, target, selected }) => {
      if (!selected || !target.trim()) return;
      values[target.trim()] = sampleRow[source] ?? '';
    });
    return values;
  }, [mappingRows, sampleRow]);

  const toggleRowExpansion = (source: string) => {
    setExpandedRows((current) => ({
      ...current,
      [source]: !current[source]
    }));
  };

  const updateMappingRow = (index: number, changes: Partial<MappingRow>) => {
    setSaveMessage('');
    setError('');
    setMappingRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...changes } : row)));
  };

  const saveMapping = async () => {
    if (!uploadId) {
      setError('Cannot save mapping without a selected import.');
      return;
    }

    const selectedRows = mappingRows.filter(r => r.selected);
    if (!selectedRows.length) {
      setError('Map at least one selected column to a target field before saving.');
      return;
    }
    
    if (selectedRows.some(r => !r.target.trim())) {
      setError('One or more selected fields have an empty target name. Please provide a valid target field name.');
      return;
    }
    
    const targetNames = selectedRows.map(r => r.target.trim());
    if (new Set(targetNames).size !== targetNames.length) {
      setError('Duplicate target fields are not allowed. Please ensure each mapped source has a unique target.');
      return;
    }

    const payload = selectedRows.reduce<Record<string, { source: string; transformCode?: string; autoClean?: string }>>((acc, row) => {
      acc[row.target.trim()] = {
        source: row.source,
        transformCode: row.transformCode?.trim() || undefined,
        autoClean: row.autoClean || undefined
      };
      return acc;
    }, {});

    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      await api.post(`/imports/${uploadId}/mappings`, { mappings: Object.entries(payload).map(([target, {source, transformCode, autoClean}]) => ({sourceField: source, targetField: target, transformRule: JSON.stringify({ customCode: transformCode, autoClean }) })) });
      setSaveMessage('Mapping saved successfully.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Unable to save mapping.'));
      toast.error('Mapping save failed.');
    } finally {
      setSaving(false);
    }
  };

  const runTransform = async () => {
    if (!uploadId) {
      setError('Cannot run transform without a selected import.');
      return;
    }

    const selectedRows = mappingRows.filter(r => r.selected);
    if (!selectedRows.length) {
      setError('Map at least one selected column to a target field before transforming.');
      return;
    }
    
    if (selectedRows.some(r => !r.target.trim())) {
      setError('One or more selected fields have an empty target name. Please provide a valid target field name.');
      return;
    }
    
    const targetNames = selectedRows.map(r => r.target.trim());
    if (new Set(targetNames).size !== targetNames.length) {
      setError('Duplicate target fields are not allowed. Please ensure each mapped source has a unique target.');
      return;
    }

    const payload = selectedRows.reduce<Record<string, { source: string; transformCode?: string; autoClean?: string }>>((acc, row) => {
      acc[row.target.trim()] = {
        source: row.source,
        transformCode: row.transformCode?.trim() || undefined,
        autoClean: row.autoClean || undefined
      };
      return acc;
    }, {});

    setSaving(true);
    setSaveMessage('');
    setError('');

    try {
      await api.patch(`/imports/${uploadId}/mappings`, { mappings: Object.entries(payload).map(([target, {source, transformCode, autoClean}]) => ({sourceField: source, targetField: target, transformRule: JSON.stringify({ customCode: transformCode, autoClean }) })) });
      const response = await api.post(`/imports/${uploadId}/run`);
      setSaveMessage('Transformation started. Redirecting to import status...');
      setTimeout(() => navigate(`/history`), 1500);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Unable to run transformation.'));
      toast.error('Transformation failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name.');
      return;
    }

    const selectedRows = mappingRows.filter(r => r.selected);
    if (!selectedRows.length) {
      setError('Map at least one selected column before saving a template.');
      return;
    }

    const payload = selectedRows.reduce<Record<string, { source: string; transformCode?: string }>>((acc, row) => {
      if (!row.target.trim()) return acc;
      acc[row.target.trim()] = {
        source: row.source,
        transformCode: row.transformCode?.trim() || undefined
      };
      return acc;
    }, {});

    try {
      await api.post('/workflows', { name: templateName, definition: payload });
      setSaveMessage('Template saved successfully.');
      setTemplateName('');
      const response = await api.get('/workflows');
      setWorkflows(response.data.workflows ?? []);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Unable to save template.'));
      toast.error('Template save failed.');
    }
  };

  const loadTemplate = async (id: string) => {
    if (!id) return;
    try {
      const res = await api.get(`/workflows/${id}`);
      const def = res.data.workflow?.definition;
      if (def) {
        const rows = buildMappingRows(def, sourceColumns);
        setMappingRows(rows);
        setSaveMessage('Template loaded.');
      }
    } catch {
      setError('Unable to load template.');
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Mapping Studio</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Define mappings with precision and enterprise control.</h1>
            <p className="mt-4 text-slate-400">
              Map selected source columns to your target schema and preview transformed output before final import.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Dataset-driven source fields</div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
          {oneDatasetAvailable ? (
            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
              <p className="text-sm font-medium text-slate-300">Dataset</p>
              <p className="mt-2 text-lg font-semibold text-white">{importJobs[0]?.fileName ?? 'Dataset'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-900/80 p-3 text-sm text-slate-300">
                  <p className="text-slate-400">Columns</p>
                  <p className="mt-1 font-semibold text-white">{availableSourceFields.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-3 text-sm text-slate-300">
                  <p className="text-slate-400">Rows</p>
                  <p className="mt-1 font-semibold text-white">{importJobs[0]?.totalRows?.toLocaleString() ?? '—'}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-3 text-sm text-slate-300">
                  <p className="text-slate-400">Status</p>
                  <p className="mt-1 font-semibold text-white">{importJobs[0]?.status ?? 'unknown'}</p>
                </div>
              </div>
              {!uploadId && (
                <button
                  type="button"
                  onClick={() => navigate(`/mapping?uploadId=${importJobs[0]?.uploadId}`)}
                  className="mt-5 inline-flex items-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Use this dataset
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
              <label htmlFor="datasetSelect" className="block text-sm font-medium text-slate-300">Select dataset</label>
              <select
                id="datasetSelect"
                value={uploadId}
                onChange={(event) => navigate(`/mapping?uploadId=${event.target.value}`)}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
              >
                <option value="">Choose a dataset</option>
                {importJobs.map((job) => (
                  <option key={job.uploadId} value={job.uploadId}>
                    {job.fileName} {job.status !== 'completed' ? `(${job.status})` : ''}
                  </option>
                ))}
              </select>
              {!importJobs.length && (
                <p className="mt-3 text-sm text-slate-400">No uploaded datasets found. Upload a dataset first to begin mapping.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {loading && <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Loading sample rows...</div>}

      <ErrorAlert message={error} />

      {!loading && !error && !uploadId && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 text-slate-300">Select a dataset to load available columns and enable mapping.</div>
      )}

      {/* DATA HEALTH DASHBOARD */}
      {!loading && !error && uploadId && dataProfile && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-400">Data Health Profile</p>
              <p className="mt-2 text-slate-300">Computed sample statistics from the original raw file.</p>
            </div>
            {profiling && <div className="animate-pulse rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Profiling stream...</div>}
          </div>
          <div className="mt-6 overflow-x-auto">
            <div className="flex gap-4 pb-4">
              {Object.values(dataProfile).map((col: any) => (
                <div key={col.name} className="min-w-[240px] flex-shrink-0 rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white truncate pr-2">{col.name}</p>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{col.typeGuess}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Valid</span>
                        <span className="text-emerald-400">{(((col.totalCount - col.nullCount) / col.totalCount) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${((col.totalCount - col.nullCount) / col.totalCount) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Length: {col.minLength} - {col.maxLength}</span>
                      <span>Nulls: {col.nullCount}</span>
                    </div>
                    {col.distinctSamples.length > 0 && (
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-xs text-slate-500 mb-2">Samples:</p>
                        <div className="flex flex-wrap gap-1">
                          {col.distinctSamples.slice(0, 3).map((sample: string, i: number) => (
                            <span key={i} className="inline-block rounded-md bg-slate-800/50 px-1.5 py-0.5 text-[10px] text-slate-300 truncate max-w-[80px]">
                              {sample}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && uploadId && (
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Current mapping rules</p>
                <p className="mt-2 text-slate-300">Use selected source columns from your uploaded dataset as the source side for mapping.</p>
              </div>
              <div className="inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">Detected source columns: {availableSourceFields.length}</div>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <label htmlFor="searchFields" className="sr-only">Search fields</label>
                <input
                  id="searchFields"
                  type="search"
                  value={searchFilter}
                  onChange={(event) => setSearchFilter(event.target.value)}
                  placeholder="Search fields..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  onChange={(e) => loadTemplate(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
                >
                  <option value="">Load workflow template...</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/70">
              <div className="hidden grid-cols-[0.5fr_1.5fr_1.4fr_0.9fr] gap-4 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-500 sm:grid">
                <div className="flex items-center justify-center">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    id="selectAll"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="h-5 w-5 cursor-pointer accent-cyan-400"
                  />
                </div>
                <div>Source field</div>
                <div>Target field</div>
                <div>Action</div>
              </div>

              <div className="max-h-[720px] overflow-y-auto">
                {visibleRows.length ? visibleRows.map((row) => {
                  const expanded = expandedRows[row.source];
                  const isSelected = !!row.selected;
                  const isValid = isSelected && row.target.trim() !== '';
                  return (
                    <div key={`${row.source}-${row.rowIndex}`} className={`border-b border-white/10 px-4 py-4 last:border-none transition-colors ${isSelected ? 'bg-cyan-500/5' : ''}`}>
                      <div className="grid gap-3 sm:grid-cols-[0.5fr_1.5fr_1.4fr_0.9fr] sm:items-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            id={`select-${row.rowIndex}`}
                            checked={isSelected}
                            onChange={(event) => {
                              updateMappingRow(row.rowIndex, { selected: event.target.checked, target: event.target.checked ? (row.target || row.source) : row.target });
                            }}
                            className="h-5 w-5 cursor-pointer accent-cyan-400 rounded"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor={`select-${row.rowIndex}`} className="font-medium text-white cursor-pointer truncate">
                            {row.source}
                          </label>
                          {isValid && <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div>
                          {isSelected ? (
                            <input
                              type="text"
                              value={row.target}
                              onChange={(e) => updateMappingRow(row.rowIndex, { target: e.target.value })}
                              placeholder="Target field name"
                              className={`w-full rounded-2xl border ${row.target.trim() ? 'border-white/10' : 'border-rose-500/50'} bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400`}
                            />
                          ) : (
                            <div className="text-sm text-slate-500 italic px-4 py-3">Ignored</div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(row.source)}
                              className="rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-900"
                            >
                              {expanded ? 'Hide transform' : 'Advanced'}
                            </button>
                          )}
                        </div>
                      </div>

                      {expanded && isSelected && (
                        <div className="mt-4 sm:col-span-4 rounded-[20px] bg-slate-900/40 p-4 border border-white/5 space-y-4">
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 block">Smart Auto-Cleaning</label>
                            <select
                              value={row.autoClean || ''}
                              onChange={(e) => updateMappingRow(row.rowIndex, { autoClean: e.target.value })}
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400"
                            >
                              <option value="">None (Raw Value)</option>
                              <option value="trim">Strip Whitespace</option>
                              <option value="uppercase">Uppercase</option>
                              <option value="lowercase">Lowercase</option>
                              <option value="extractNumbers">Extract Numbers Only</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 block">Custom Javascript Override</label>
                            <textarea
                              value={row.transformCode ?? ''}
                              onChange={(event) => updateMappingRow(row.rowIndex, { transformCode: event.target.value })}
                              placeholder="Optional: return value.toUpperCase();"
                              rows={3}
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 font-mono text-xs text-cyan-100 outline-none transition focus:border-cyan-400"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/80 text-2xl">🔍</div>
                    No matching source fields found. Adjust your search filter or dataset selection.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={saveMapping}
                disabled={saving || !mappingRows.length}
                className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save mapping'}
              </button>
              <button
                onClick={runTransform}
                disabled={saving || !mappingRows.length}
                className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Processing…' : 'Run transformation'}
              </button>
              
              <div className="flex-1" />
              
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template Name"
                  className="rounded-full border border-white/10 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
                />
                <button
                  onClick={saveAsTemplate}
                  disabled={!templateName.trim() || !mappingRows.length}
                  className="rounded-full border border-white/10 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save as Template
                </button>
              </div>
            </div>
            {saveMessage && <p className="mt-3 text-sm text-emerald-300">{saveMessage}</p>}
          </div>

          <aside className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-300">Transformation preview</p>
            <p className="mt-3 text-slate-400">See the first destination values before applying the mapping to your full dataset.</p>
            {Object.keys(mappedValues).length ? (
              <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/70">
                <div className="grid grid-cols-[1fr_1fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                  <div>Source value</div>
                  <div>Transformed value</div>
                </div>
                <div className="divide-y divide-white/10">
                  {mappingRows.filter((row) => row.selected && row.target.trim()).map((row) => (
                    <div key={`${row.source}-preview`} className="grid grid-cols-[1fr_1fr] gap-3 px-4 py-3 text-sm text-slate-200">
                      <div>
                        <p className="text-xs text-slate-500">[{row.source}]</p>
                        <p className="mt-1 truncate">{String(sampleRow[row.source] ?? '—')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">[{row.target.trim()}]</p>
                        <p className="mt-1 truncate">{String(mappedValues[row.target.trim()] ?? '—')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-slate-400">No transformations configured yet.</div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default MappingPage;
