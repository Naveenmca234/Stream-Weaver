import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  RefreshCw,
} from 'lucide-react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  getCsvPreview,
  previewCsvMapping,
} from '../services/fileApi';

import '../styles/mapping.css';

const DESTINATION_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_DESTINATION_FIELD_LENGTH = 120;

function suggestDestinationField(label, index) {
  const words = String(label ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, ' ')
    .replace(/_+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let suggestion = words
    .map((word, wordIndex) => {
      const normalized = word.toLowerCase();

      if (wordIndex === 0) {
        return normalized;
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join('');

  if (!suggestion) {
    suggestion = `field${index + 1}`;
  }

  if (/^[0-9]/.test(suggestion)) {
    suggestion = `field_${suggestion}`;
  }

  return suggestion;
}

function buildDefaultMappings(columns) {
  return columns.map((column) => ({
    sourceKey: column.key,
    sourceIndex: column.index,
    sourceLabel: column.label,
    destinationField: suggestDestinationField(
      column.label,
      column.index,
    ),
  }));
}

function hasMatchingSourceColumns(mappings, columns) {
  return (
    Array.isArray(mappings) &&
    mappings.length === columns.length &&
    mappings.every((mapping, index) => {
      const column = columns[index];

      return (
        mapping?.sourceKey === column.key &&
        mapping?.sourceIndex === column.index &&
        typeof mapping?.destinationField === 'string'
      );
    })
  );
}

function validateMappings(mappings) {
  const errors = new Map();
  const destinations = new Map();

  for (const mapping of mappings) {
    const field = mapping.destinationField.trim();

    if (!field) {
      errors.set(
        mapping.sourceKey,
        'Destination field is required.',
      );
      continue;
    }

    if (
      field.length > MAX_DESTINATION_FIELD_LENGTH ||
      !DESTINATION_FIELD_PATTERN.test(field)
    ) {
      errors.set(
        mapping.sourceKey,
        'Use 120 or fewer letters, numbers, and underscores; start with a letter or underscore.',
      );
      continue;
    }

    if (
      field === '__proto__' ||
      field === 'constructor' ||
      field === 'prototype'
    ) {
      errors.set(
        mapping.sourceKey,
        'Choose a different destination field name.',
      );
      continue;
    }

    const duplicateKey = field.toLocaleLowerCase();

    if (destinations.has(duplicateKey)) {
      errors.set(
        mapping.sourceKey,
        'Destination field names must be unique.',
      );

      errors.set(
        destinations.get(duplicateKey),
        'Destination field names must be unique.',
      );
    } else {
      destinations.set(
        duplicateKey,
        mapping.sourceKey,
      );
    }
  }

  return errors;
}

function getErrorMessage(error) {
  if (!error.response) {
    return 'StreamWeaver could not reach the backend. Check that the API server is running.';
  }

  return (
    error.response.data?.message ||
    'The mapping could not be validated.'
  );
}

export default function MappingPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [status, setStatus] = useState('loading');
  const [requestStatus, setRequestStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [mappedPreview, setMappedPreview] = useState(null);

  const mappingErrors = useMemo(
    () => validateMappings(mappings),
    [mappings],
  );

  const mappingIsValid =
    mappings.length > 0 && mappingErrors.size === 0;

  useEffect(() => {
    let active = true;

    async function loadDataset() {
      try {
        const result = await getCsvPreview(uploadId);

        if (!active) {
          return;
        }

        setPreview(result);

        const storageKey = `streamweaver:mapping:${uploadId}`;
        const stored = sessionStorage.getItem(storageKey);

        if (stored) {
          try {
            const parsed = JSON.parse(stored);

            if (hasMatchingSourceColumns(parsed, result.columns)) {
              setMappings(parsed);
            } else {
              setMappings(buildDefaultMappings(result.columns));
            }
          } catch {
            setMappings(buildDefaultMappings(result.columns));
          }
        } else {
          setMappings(buildDefaultMappings(result.columns));
        }

        setStatus('ready');
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus('error');
        setErrorMessage(getErrorMessage(error));
      }
    }

    void loadDataset();

    return () => {
      active = false;
    };
  }, [uploadId]);

  useEffect(() => {
    if (status !== 'ready' || mappings.length === 0) {
      return;
    }

    sessionStorage.setItem(
      `streamweaver:mapping:${uploadId}`,
      JSON.stringify(mappings),
    );
  }, [mappings, status, uploadId]);

  function updateDestinationField(sourceKey, value) {
    setMappings((current) =>
      current.map((mapping) =>
        mapping.sourceKey === sourceKey
          ? {
              ...mapping,
              destinationField: value,
            }
          : mapping,
      ),
    );

    setMappedPreview(null);
    setRequestStatus('idle');
    setErrorMessage('');
  }

  function resetMappings() {
    const defaults = buildDefaultMappings(preview.columns);
    setMappings(defaults);
    setMappedPreview(null);
    setRequestStatus('idle');
    setErrorMessage('');
  }

  async function validateWithStreamPipeline() {
    if (!mappingIsValid || requestStatus === 'loading') {
      return;
    }

    setRequestStatus('loading');
    setErrorMessage('');
    setMappedPreview(null);

    try {
      const result = await previewCsvMapping(
        uploadId,
        mappings.map((mapping) => ({
          sourceKey: mapping.sourceKey,
          sourceIndex: mapping.sourceIndex,
          destinationField: mapping.destinationField.trim(),
        })),
      );

      setMappedPreview(result);
      setRequestStatus('success');
    } catch (error) {
      setRequestStatus('error');
      setErrorMessage(getErrorMessage(error));
    }
  }

  function downloadMappedPreview() {
    if (!mappedPreview) {
      return;
    }

    const exportData = mappedPreview.rows.map((row) => row.data);
    const blob = new Blob(
      [JSON.stringify(exportData, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${mappedPreview.fileName.replace(/\.csv$/i, '')}-mapped-preview.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (status === 'loading') {
    return (
      <div className="mapping-state-page">
        <div className="preview-loader" />
        <strong>Preparing column mapping</strong>
        <p>Loading detected source fields from the bounded CSV preview.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mapping-state-page mapping-error-state">
        <AlertTriangle size={28} />
        <h1>Mapping unavailable</h1>
        <p>{errorMessage}</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate('/imports/new')}
        >
          Start new import
        </button>
      </div>
    );
  }

  return (
    <div className="mapping-page">
      <div className="mapping-page-header">
        <div>
          <button
            type="button"
            className="preview-back-button"
            onClick={() =>
              navigate(`/imports/${uploadId}/preview`)
            }
          >
            <ArrowLeft size={15} />
            Dataset preview
          </button>

          <p className="page-eyebrow">COLUMN MAPPING</p>
          <h1>Map destination fields</h1>
          <p>
            Define how each detected CSV column becomes a destination field in the ETL output.
          </p>
        </div>

        <div className="mapping-file-context">
          <Database size={18} />
          <div>
            <span>Source dataset</span>
            <strong>{preview.fileName}</strong>
          </div>
        </div>
      </div>

      <section className="mapping-panel">
        <div className="mapping-panel-heading">
          <div>
            <h2>Source to destination</h2>
            <p>{mappings.length} detected field(s) require a unique destination name.</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={resetMappings}
          >
            <RefreshCw size={15} />
            Reset suggestions
          </button>
        </div>

        <div className="mapping-column-labels" aria-hidden="true">
          <span>Source CSV column</span>
          <span />
          <span>Destination field</span>
        </div>

        <div className="mapping-list">
          {mappings.map((mapping) => {
            const error = mappingErrors.get(mapping.sourceKey);

            return (
              <div
                className={`mapping-row ${error ? 'mapping-row-error' : ''}`}
                key={mapping.sourceKey}
              >
                <div className="source-field">
                  <strong>{mapping.sourceLabel}</strong>
                  <span>Column {mapping.sourceIndex + 1}</span>
                </div>

                <ArrowRight className="mapping-arrow" size={17} />

                <div className="destination-field">
                  <input
                    type="text"
                    value={mapping.destinationField}
                    onChange={(event) =>
                      updateDestinationField(
                        mapping.sourceKey,
                        event.target.value,
                      )
                    }
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error ? `mapping-error-${mapping.sourceIndex}` : undefined
                    }
                  />

                  {error ? (
                    <small
                      id={`mapping-error-${mapping.sourceIndex}`}
                      className="mapping-field-error"
                    >
                      {error}
                    </small>
                  ) : (
                    <small>MongoDB-safe application field name</small>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mapping-actions">
          <div className="mapping-validity">
            {mappingIsValid ? (
              <>
                <CheckCircle2 size={16} />
                Mapping configuration is valid
              </>
            ) : (
              <>
                <AlertTriangle size={16} />
                Resolve mapping errors before validation
              </>
            )}
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={!mappingIsValid || requestStatus === 'loading'}
            onClick={validateWithStreamPipeline}
          >
            {requestStatus === 'loading' ? (
              <>
                <RefreshCw size={16} className="spin" />
                Testing stream...
              </>
            ) : (
              'Test mapping pipeline'
            )}
          </button>
        </div>
      </section>

      {requestStatus === 'error' && (
        <div className="mapping-request-error" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Mapping pipeline failed</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {mappedPreview && requestStatus === 'success' && (
        <section className="mapped-preview-panel">
          <div className="mapped-preview-heading">
            <div>
              <p className="page-eyebrow">STREAM RESULT</p>
              <h2>Mapped object preview</h2>
              <p>
                Generated by the Node.js CSV object Transform to Mapping Transform pipeline.
              </p>
            </div>

            <div className="mapping-success-badge">
              <CheckCircle2 size={15} />
              Pipeline verified
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={downloadMappedPreview}
              title="Download the mapped preview rows as JSON"
            >
              <Download size={15} />
              Download JSON
            </button>
          </div>

          <div className="mapped-preview-table-wrap">
            <table className="mapped-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  {mappedPreview.mappings.map((mapping) => (
                    <th key={mapping.destinationField}>
                      {mapping.destinationField}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {mappedPreview.rows.slice(0, 8).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    {mappedPreview.mappings.map((mapping) => (
                      <td key={mapping.destinationField}>
                        {row.data[mapping.destinationField] === null ||
                        row.data[mapping.destinationField] === ''
                          ? '-'
                          : row.data[mapping.destinationField]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mapped-preview-footer">
            <span>
              Backend preview: {mappedPreview.previewCount} / {mappedPreview.previewLimit}
              {mappedPreview.hasMoreRows ? ' - additional rows exist' : ''}
            </span>
            <strong>
              Week 2 mapping + Transform stream verification complete for this configuration.
            </strong>
          </div>
        </section>
      )}
    </div>
  );
}
