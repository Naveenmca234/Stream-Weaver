import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  Rows3,
  Timer,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  getProcessingJob,
} from '../services/fileApi';
import {
  createJobSocket,
} from '../services/socket';

import '../styles/processing.css';

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function getErrorMessage(error) {
  if (!error?.response) {
    return 'StreamWeaver could not reach the backend. Check that the API server is running.';
  }

  return (
    error.response.data?.message ||
    'The processing job could not be loaded.'
  );
}

export default function ProcessingPage() {
  const { uploadId, jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [pageStatus, setPageStatus] = useState('loading');
  const [socketConnected, setSocketConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isTerminal =
    job?.status === 'completed' ||
    job?.status === 'failed' ||
    job?.status === 'cancelled';

  const progress = useMemo(
    () => Math.min(100, Math.max(0, Number(job?.progressPercent) || 0)),
    [job?.progressPercent],
  );

  useEffect(() => {
    let active = true;
    const socket = createJobSocket();

    async function refreshJob() {
      try {
        const result = await getProcessingJob(jobId);

        if (!active) {
          return;
        }

        setJob(result);
        setPageStatus('ready');
        setErrorMessage('');
      } catch (error) {
        if (!active) {
          return;
        }

        setPageStatus('error');
        setErrorMessage(getErrorMessage(error));
      }
    }

    function acceptJobUpdate(payload) {
      if (!active || payload?.jobId !== jobId) {
        return;
      }

      setJob(payload);
      setPageStatus('ready');
      setErrorMessage('');
    }

    socket.on('connect', () => {
      if (!active) {
        return;
      }

      setSocketConnected(true);
      socket.emit('job:subscribe', jobId);
      void refreshJob();
    });

    socket.on('disconnect', () => {
      if (active) {
        setSocketConnected(false);
      }
    });

    socket.on('connect_error', () => {
      if (active) {
        setSocketConnected(false);
      }
    });

    socket.on('job:started', acceptJobUpdate);
    socket.on('job:progress', acceptJobUpdate);
    socket.on('job:completed', acceptJobUpdate);
    socket.on('job:failed', acceptJobUpdate);

    void refreshJob();
    socket.connect();

    const fallbackPoll = window.setInterval(() => {
      if (!isTerminal) {
        void refreshJob();
      }
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(fallbackPoll);
      socket.emit('job:unsubscribe', jobId);
      socket.disconnect();
    };
  }, [jobId, isTerminal]);

  if (pageStatus === 'loading') {
    return (
      <div className="processing-state-page">
        <div className="preview-loader" />
        <strong>Connecting to processing job</strong>
        <p>Loading the current stream-processing state.</p>
      </div>
    );
  }

  if (pageStatus === 'error') {
    return (
      <div className="processing-state-page processing-error-state">
        <AlertTriangle size={30} />
        <h1>Processing status unavailable</h1>
        <p>{errorMessage}</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate(`/imports/${uploadId}/mapping`)}
        >
          Back to mapping
        </button>
      </div>
    );
  }

  return (
    <div className="processing-page">
      <div className="processing-header">
        <div>
          <p className="page-eyebrow">LIVE ETL PROCESSING</p>
          <h1>
            {job.status === 'completed'
              ? 'Processing complete'
              : job.status === 'failed'
                ? 'Processing failed'
                : 'Processing dataset'}
          </h1>
          <p>
            Stream metadata is delivered from Node.js to this page through Socket.IO.
          </p>
        </div>

        <div className={`socket-status ${socketConnected ? 'online' : 'offline'}`}>
          {socketConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
          {socketConnected ? 'Live connection' : 'Reconnecting'}
        </div>
      </div>

      <section className="processing-main-card">
        <div className="processing-file-row">
          <div className="processing-file-icon">
            <Database size={21} />
          </div>
          <div>
            <span>Source dataset</span>
            <strong>{job.fileName}</strong>
          </div>
          <div className={`job-status-pill status-${job.status}`}>
            {job.status === 'completed' ? (
              <CheckCircle2 size={15} />
            ) : job.status === 'failed' ? (
              <AlertTriangle size={15} />
            ) : (
              <Activity size={15} />
            )}
            {job.status}
          </div>
        </div>

        <div className="processing-progress-block">
          <div className="processing-progress-copy">
            <div>
              <span>Current stage</span>
              <strong>{job.stage}</strong>
            </div>
            <strong className="processing-percent">{progress}%</strong>
          </div>

          <div
            className="processing-progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
          >
            <div
              className="processing-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="processing-metrics-grid">
          <article className="processing-metric">
            <Rows3 size={19} />
            <span>Rows processed</span>
            <strong>{formatNumber(job.rowsProcessed)}</strong>
          </article>

          <article className="processing-metric">
            <Gauge size={19} />
            <span>Processing speed</span>
            <strong>{formatNumber(job.rowsPerSecond)} rows/s</strong>
          </article>

          <article className="processing-metric">
            <CheckCircle2 size={19} />
            <span>Successful rows</span>
            <strong>{formatNumber(job.successfulRows)}</strong>
          </article>

          <article className="processing-metric">
            <Timer size={19} />
            <span>Elapsed time</span>
            <strong>{formatElapsed(job.elapsedSeconds)}</strong>
          </article>
        </div>

        {job.status === 'failed' && (
          <div className="processing-failure" role="alert">
            <AlertTriangle size={19} />
            <div>
              <strong>{job.error?.code || 'PROCESSING_FAILED'}</strong>
              <p>{job.error?.message || 'The processing stream failed.'}</p>
            </div>
          </div>
        )}

        {job.status === 'completed' && (
          <div className="processing-success">
            <CheckCircle2 size={20} />
            <div>
              <strong>Stream processing finished successfully</strong>
              <p>
                Week 3 processing completed without buffering the full dataset in memory.
              </p>
            </div>
          </div>
        )}

        <div className="processing-footer-actions">
          <span>Job ID: {job.jobId}</span>
          {isTerminal && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/imports/new')}
            >
              New import
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
