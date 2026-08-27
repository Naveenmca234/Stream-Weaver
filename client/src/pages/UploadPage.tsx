import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import uploadFile from '../services/uploadService';
import { joinRoom, onImportProgress } from '../services/socket';
import toast from 'react-hot-toast';
import ErrorAlert, { extractErrorMessage } from '../components/ErrorAlert';

const UploadPage = () => {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [savingColumns, setSavingColumns] = useState(false);

  const [progress, setProgress] = useState(0);
  const [rowsProcessed, setRowsProcessed] = useState(0);
  const [rowsFailed, setRowsFailed] = useState(0);
  const [rowsPerSecond, setRowsPerSecond] = useState(0);

  const clientUploadIdRef = useRef('');

  useEffect(() => {
    const unsubscribe = onImportProgress((payload) => {
      if (payload.uploadId !== clientUploadIdRef.current) return;
      setProgress(payload.progress ?? 0);
      setRowsProcessed(payload.rowsProcessed ?? 0);
      setRowsFailed(payload.rowsFailed ?? 0);
      setRowsPerSecond(payload.rowsPerSecond ?? 0);
    });
    return unsubscribe;
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const rejectedFile = fileRejections[0].file;
      toast.error(`Unsupported file type: ${rejectedFile.name}. Please upload a CSV or JSON file.`);
      return;
    }

    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];

    if (!['text/csv', 'application/json', 'application/octet-stream'].includes(file.type) && !/\.(csv|json)$/i.test(file.name)) {
      toast.error(`Unsupported file type: ${file.name}. Please upload a CSV or JSON file.`);
      return;
    }

    if (file.size === 0) {
      toast.error(`The file ${file.name} is empty. Please select a valid dataset containing data.`);
      return;
    }

    const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const limitGB = MAX_FILE_SIZE / (1024 * 1024 * 1024);
      toast.error(`File ${file.name} (${sizeMB} MB) is too large. Maximum allowed size is ${limitGB}GB.`);
      return;
    }

    const clientUploadId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    clientUploadIdRef.current = clientUploadId;

    setFileName('');
    setUploadId('');
    setTotalRows(null);
    setAvailableColumns([]);
    setSelectedColumns([]);
    setProfile(null);
    setProgress(0);
    setRowsProcessed(0);
    setRowsFailed(0);
    setRowsPerSecond(0);
    setUploadStatus('uploading');
    setErrorMessage('');
    setFileName(file.name); // Set early to show file name during upload

    joinRoom(clientUploadId);

    try {
      const response = await uploadFile(file, clientUploadId, (bytesSent, bytesTotal) => {
        const percent = Math.round((bytesSent / bytesTotal) * 100);
        setProgress(percent);
      });
      const uploadPreview = response.preview ?? [];
      const id = response.jobId ?? clientUploadId;
      const columns = response.columns ?? Array.from(new Set(uploadPreview.flatMap(Object.keys)));

      setFileName(response.fileName);
      setUploadId(id);
      setTotalRows(response.total ?? response.totalRows ?? null);
      setAvailableColumns(columns);
      setSelectedColumns(columns);
      setProgress(100);

      const profileResponse = await api.get('/profiling', { params: { uploadId: id } });
      setProfile(profileResponse.data.profile);
      setUploadStatus('success');
      toast.success('Upload complete! Dataset is ready for profiling.');
    } catch (err: any) {
      const errorMsg = extractErrorMessage(err, 'Upload failed. Please try again.');
      console.error('Upload page error:', err);
      setErrorMessage(errorMsg);
      setUploadStatus('error');
      toast.error(errorMsg);
    }
  }, []);

  const continueToMapping = async () => {
    if (!selectedColumns.length) {
      toast.error('Select at least one column before continuing.');
      return;
    }

    if (uploadId) {
      setSavingColumns(true);
      try {
        await api.patch(`/imports/${uploadId}/columns`, { selectedColumns });
        navigate(`/mapping?uploadId=${uploadId}`);
      } catch {
        toast.error('Unable to save selected columns.');
      } finally {
        setSavingColumns(false);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject, open } = useDropzone({ 
    onDrop, 
    multiple: false, 
    accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] } 
  });

  let dropzoneClasses = 'min-h-[320px] flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-10 text-center transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/50 ';
  
  if (isDragReject) {
    dropzoneClasses += 'border-rose-500 bg-rose-500/10 scale-[1.02]';
  } else if (isDragAccept) {
    dropzoneClasses += 'border-emerald-500 bg-emerald-500/10 scale-[1.02]';
  } else if (isDragActive) {
    dropzoneClasses += 'border-cyan-400 bg-cyan-500/10 scale-[1.02]';
  } else {
    dropzoneClasses += 'border-white/10 bg-slate-950/80 hover:border-cyan-400 hover:bg-slate-900';
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
               <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Upload dataset</p>
               <h1 className="mt-3 text-4xl font-semibold text-white">Enterprise-grade data ingestion with end-to-end visibility.</h1>
               <p className="mt-4 text-slate-400">
                 Upload large CSV or JSON files using a secure, streamed ingestion channel designed for modern data teams.
               </p>
            </div>
            <button onClick={() => navigate('/dashboard')} className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-800/90 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
              Back to dashboard
            </button>
          </div>
        </section>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
            <div {...getRootProps()} className={dropzoneClasses}>
              <input {...getInputProps()} />
              
              <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full text-4xl transition-colors duration-200 ${isDragReject ? 'bg-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : isDragAccept ? 'bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : isDragActive ? 'bg-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-slate-900 shadow-inner'}`}>
                {isDragReject ? '🚫' : isDragAccept ? '✅' : isDragActive ? '📥' : '📄'}
              </div>

              <p className={`text-2xl font-semibold transition-colors duration-200 ${isDragReject ? 'text-rose-400' : isDragAccept ? 'text-emerald-400' : isDragActive ? 'text-cyan-400' : 'text-white'}`}>
                {isDragReject ? 'Unsupported file format' : isDragAccept ? 'Drop file to start upload' : isDragActive ? 'Drop your dataset here' : 'Drag and drop your CSV or JSON file here.'}
              </p>
              
              <p className="mt-3 text-sm text-slate-400 max-w-xl">Accepted formats: CSV and JSON.</p>
              
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/50"
              >
                Choose CSV or JSON
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_0.8fr]">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Upload status</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/80 text-lg font-semibold text-cyan-300">{progress}%</div>
                  <div>
                    <p className="text-sm text-slate-300">Live ingestion</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {uploadStatus === 'uploading' ? 'Processing' : uploadStatus === 'success' ? 'Ready' : uploadStatus === 'error' ? 'Failed' : 'Waiting'}
                    </p>
                    {uploadStatus === 'error' && errorMessage && (
                      <div className="mt-4">
                        <ErrorAlert message={errorMessage} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Performance</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between"><span>Rows processed</span><span>{rowsProcessed.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Rows/sec</span><span>{rowsPerSecond.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Validation flags</span><span className="text-rose-300">{rowsFailed.toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {uploadStatus === 'success' && fileName && (
              <>
                <div className="mt-6 rounded-[32px] border border-white/10 bg-slate-950/80 p-8 shadow-xl">
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Dataset profiling</p>
                  <p className="mt-2 text-slate-400">Automated quality and schema analysis for your uploaded file.</p>

                  {!profile ? (
                    <div className="mt-8 flex flex-col items-center justify-center rounded-[28px] border border-white/5 bg-slate-900/50 p-12 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-2xl shadow-inner">📊</div>
                      <p className="text-lg font-medium text-white">Profiling in progress</p>
                      <p className="mt-2 text-sm text-slate-400">We are analyzing the schema and data quality...</p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-cyan-500 hover:bg-slate-800/80 transition-colors">
                          <p className="text-sm text-slate-400 flex items-center gap-2">
                            <span className="text-cyan-400">☰</span> Total rows
                          </p>
                          <p className="mt-3 text-3xl font-semibold text-white">{profile?.totalRows?.toLocaleString() ?? totalRows?.toLocaleString() ?? '—'}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-indigo-500 hover:bg-slate-800/80 transition-colors">
                          <p className="text-sm text-slate-400 flex items-center gap-2">
                            <span className="text-indigo-400">▤</span> Total columns
                          </p>
                          <p className="mt-3 text-3xl font-semibold text-white">{profile?.totalColumns ?? '—'}</p>
                        </div>
                        <div className={`rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-lg border-l-4 hover:bg-slate-800/80 transition-colors ${profile?.totalMissingValues > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                          <p className="text-sm text-slate-400 flex items-center gap-2">
                            <span className={profile?.totalMissingValues > 0 ? 'text-amber-400' : 'text-emerald-400'}>{profile?.totalMissingValues > 0 ? '⚠️' : '✅'}</span> Missing values
                          </p>
                          <p className="mt-3 text-3xl font-semibold text-white">{profile?.totalMissingValues?.toLocaleString() ?? '—'}</p>
                        </div>
                        <div className={`rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-lg border-l-4 hover:bg-slate-800/80 transition-colors ${profile?.totalDuplicateRows > 0 ? 'border-l-rose-500' : 'border-l-emerald-500'}`}>
                          <p className="text-sm text-slate-400 flex items-center gap-2">
                            <span className={profile?.totalDuplicateRows > 0 ? 'text-rose-400' : 'text-emerald-400'}>{profile?.totalDuplicateRows > 0 ? '🚫' : '✅'}</span> Duplicate rows
                          </p>
                          <p className="mt-3 text-3xl font-semibold text-white">{profile?.totalDuplicateRows?.toLocaleString() ?? '—'}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-sm">
                          <p className="text-sm text-slate-400">Numeric columns</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-200">{profile?.numberNumericColumns ?? '—'}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-sm">
                          <p className="text-sm text-slate-400">Text columns</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-200">{profile?.numberTextColumns ?? '—'}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-sm">
                          <p className="text-sm text-slate-400">Date columns</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-200">{profile?.numberDateColumns ?? '—'}</p>
                        </div>
                        <div className="rounded-[24px] border border-white/5 bg-slate-900/80 p-5 shadow-sm bg-gradient-to-br from-slate-900/80 to-slate-800/80">
                          <p className="text-sm text-slate-400">Quality score</p>
                          <div className="mt-2 flex items-baseline gap-2">
                            <p className="text-2xl font-semibold text-white">{profile?.qualityScore != null ? `${profile.qualityScore}%` : '—'}</p>
                            {profile?.qualityScore != null && (
                              <span className={`text-xs font-medium ${profile.qualityScore >= 95 ? 'text-emerald-400' : profile.qualityScore >= 80 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {profile.qualityScore >= 95 ? 'Excellent' : profile.qualityScore >= 80 ? 'Fair' : 'Poor'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Upload status</p>
                  <p className="mt-2 text-sm text-slate-300">Current file, processing state and progress are tracked in real time.</p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[24px] bg-slate-900/80 p-4">
                      <p className="text-sm text-slate-400">File name</p>
                      <p className="mt-3 text-lg font-semibold text-white truncate">{fileName}</p>
                    </div>
                    <div className="rounded-[24px] bg-slate-900/80 p-4">
                      <p className="text-sm text-slate-400">Status</p>
                      <p className="mt-3 text-lg font-semibold text-white">Ready</p>
                    </div>
                    <div className="rounded-[24px] bg-slate-900/80 p-4">
                      <p className="text-sm text-slate-400">Progress</p>
                      <p className="mt-3 text-lg font-semibold text-white">{progress}%</p>
                    </div>
                  </div>

                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-900">
                    <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </>
            )}

            {uploadStatus === 'success' && uploadId && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/cleaning?uploadId=${uploadId}`)}
                  className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Review missing data
                </button>
                <button
                  onClick={continueToMapping}
                  disabled={savingColumns}
                  className="rounded-full border border-white/10 bg-slate-950/90 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingColumns ? 'Saving…' : 'Continue to mapping →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
