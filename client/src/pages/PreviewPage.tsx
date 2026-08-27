import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import api from '../services/api';
import ErrorAlert, { extractErrorMessage } from '../components/ErrorAlert';
import MemoryAudit from '../components/MemoryAudit';

const PreviewPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uploadId = searchParams.get('uploadId')?.trim() ?? '';
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPreview = async () => {
    if (!uploadId) {
      setError('Please select a dataset before viewing preview.');
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/imports/${uploadId}/preview`);
      setRows(response.data.rows ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load transformed preview rows for this upload.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPreview();
  }, [searchParams]);

  const columns = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);

  const colWidth = 240;
  const tableMinWidth = Math.max(800, columns.length * colWidth);
  const gridTemplateColumns = `repeat(${columns.length}, ${colWidth}px)`;

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const data = rows[index] ?? {};
    const rowStyle: React.CSSProperties = { ...style, display: 'grid', gridTemplateColumns, gap: 16, width: tableMinWidth };
    return (
      <div style={rowStyle} className="border-b border-white/5 px-6 text-sm items-center transition-colors hover:bg-white/[0.02]">
        {columns.map((column) => {
          const val = data[column];
          const isEmpty = val === null || val === undefined || val === '';
          return (
            <div key={column} className={`truncate ${isEmpty ? 'text-slate-500 italic' : 'text-slate-200 font-medium'}`}>
              {isEmpty ? '— null —' : String(val)}
            </div>
          );
        })}
      </div>
    );
  };

  const totals = useMemo(() => ({
    rows: rows.length,
    columns: columns.length
  }), [rows, columns]);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Dataset preview</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Inspect transformed output before final import.</h1>
            <p className="mt-4 text-slate-400">Preview transformed dataset records and verify field mappings before final import.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">Rows visible: {totals.rows}</div>
            <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">Columns shown: {totals.columns}</div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => navigate(`/validation?uploadId=${uploadId}`)}
                disabled={!uploadId}
                className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm text-slate-100 transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Validate this dataset
              </button>
            </div>
            {uploadId && (
              <div className="sm:col-span-2 mt-2">
                <MemoryAudit uploadId={uploadId} />
              </div>
            )}
          </div>
        </div>
      </section>

      {loading && (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/80 p-16 shadow-2xl backdrop-blur-xl">
          <svg className="h-10 w-10 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="mt-4 text-lg font-medium text-slate-300">Loading preview data...</p>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={loadPreview} />}

      {!loading && !error && (!columns.length || !rows.length) && (
        <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-16 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/80 text-4xl shadow-inner">👀</div>
          <h3 className="mt-5 text-2xl font-semibold text-white">No mapping saved yet.</h3>
          <p className="mt-3 text-slate-400">Save a mapping and run the transformation to view preview data.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/80 shadow-2xl">
          <div className="overflow-x-auto w-full">
            <div style={{ minWidth: tableMinWidth }}>
              <div style={{ display: 'grid', gridTemplateColumns, gap: 16 }} className="border-b border-white/10 bg-slate-950/90 px-6 py-5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                {columns.map((column) => (
                  <div key={column} className="truncate">{column}</div>
                ))}
              </div>
              <List height={560} itemCount={rows.length} itemSize={56} width={tableMinWidth}>
                {Row}
              </List>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPage;
