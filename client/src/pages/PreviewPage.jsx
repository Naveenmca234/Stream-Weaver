import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Columns3,
  FileText,
  Rows3,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import VirtualizedPreviewGrid from '../components/preview/VirtualizedPreviewGrid';
import { getCsvPreview } from '../services/fileApi';
import { formatBytes } from '../utils/formatBytes';

import '../styles/preview.css';

function getPreviewErrorMessage(error) {
  const code = error.response?.data?.error?.code;

  if (
    code === 'UPLOAD_NOT_FOUND' ||
    code === 'UPLOAD_EXPIRED' ||
    code === 'UPLOAD_FILE_MISSING'
  ) {
    return 'This temporary upload is no longer available. Upload the CSV again.';
  }

  if (code === 'MALFORMED_CSV') {
    return error.response.data.message;
  }

  if (!error.response) {
    return 'The preview service could not be reached. Check that the StreamWeaver backend is running.';
  }

  return (
    error.response.data?.message ||
    'The dataset preview could not be generated.'
  );
}

export default function PreviewPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      setStatus('loading');
      setErrorMessage('');

      try {
        const result = await getCsvPreview(uploadId);

        if (!active) {
          return;
        }

        setPreview(result);
        setStatus('ready');
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus('error');
        setErrorMessage(getPreviewErrorMessage(error));
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [uploadId]);

  if (status === 'loading') {
    return (
      <div className="preview-loading">
        <div className="preview-loader" />
        <strong>Inspecting dataset</strong>
        <p>Reading the CSV stream and preparing a bounded preview.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="preview-error-page">
        <AlertTriangle size={28} />
        <h1>Preview unavailable</h1>
        <p>{errorMessage}</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate('/imports/new')}
        >
          <ArrowLeft size={16} />
          Start new import
        </button>
      </div>
    );
  }

  return (
    <div className="preview-page">
      <div className="preview-page-header">
        <div>
          <button
            type="button"
            className="preview-back-button"
            onClick={() => navigate('/imports/new')}
          >
            <ArrowLeft size={15} />
            New import
          </button>

          <p className="page-eyebrow">DATASET PREVIEW</p>
          <h1>{preview.fileName}</h1>
          <p>
            Inspect the detected CSV structure before configuring destination
            fields, transformations, and validation.
          </p>
        </div>
      </div>

      <div className="preview-metrics">
        <div className="preview-metric">
          <FileText size={18} />
          <div>
            <span>File size</span>
            <strong>{formatBytes(preview.sizeBytes)}</strong>
          </div>
        </div>

        <div className="preview-metric">
          <Columns3 size={18} />
          <div>
            <span>Detected columns</span>
            <strong>{preview.columns.length}</strong>
          </div>
        </div>

        <div className="preview-metric">
          <Rows3 size={18} />
          <div>
            <span>Preview rows</span>
            <strong>
              {preview.previewCount} / {preview.previewLimit}
            </strong>
          </div>
        </div>

        <div className="preview-metric">
          <Rows3 size={18} />
          <div>
            <span>Additional rows</span>
            <strong>{preview.hasMoreRows ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      </div>

      {preview.warnings?.length > 0 && (
        <div className="preview-warning-panel">
          <AlertTriangle size={18} />
          <div>
            <strong>Dataset structure warnings</strong>
            {preview.warnings.map((warning) => (
              <p key={warning.code}>{warning.message}</p>
            ))}
          </div>
        </div>
      )}

      <section className="preview-panel">
        <div className="preview-panel-header">
          <div>
            <h2>Dataset rows</h2>
            <p>UTF-8 preview · Only visible rows are rendered while scrolling.</p>
          </div>

          {preview.hasMoreRows && (
            <span className="preview-limit-badge">
              Preview limited to 1,000 rows
            </span>
          )}
        </div>

        <VirtualizedPreviewGrid
          columns={preview.columns}
          rows={preview.rows}
        />

        <div className="preview-footer-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/imports/new')}
          >
            Upload another
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => navigate(`/imports/${uploadId}/mapping`)}
          >
            Continue to mapping
          </button>
        </div>
      </section>
    </div>
  );
}
