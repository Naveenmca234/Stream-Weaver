 import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import UploadDropzone from '../components/upload/UploadDropzone';
import SelectedFileCard from '../components/upload/SelectedFileCard';

import {
  getUploadConfig,
  uploadCsv,
} from '../services/fileApi';

import {
  formatBytes,
} from '../utils/formatBytes';

function getApiErrorMessage(error) {
  if (!error.response) {
    return 'StreamWeaver could not reach the backend. Check that the API server is running.';
  }

  return (
    error.response.data?.message ||
    'The upload could not be completed.'
  );
}

function validateSelectedFile(
  file,
  maxFileSize,
) {
  if (!file) {
    return 'Choose a CSV file first.';
  }

  if (
    !file.name
      .toLowerCase()
      .endsWith('.csv')
  ) {
    return 'Only CSV files are supported.';
  }

  if (file.size === 0) {
    return 'The selected CSV file is empty.';
  }

  if (
    maxFileSize &&
    file.size > maxFileSize
  ) {
    return `The selected file exceeds the ${formatBytes(
      maxFileSize,
    )} server limit.`;
  }

  return null;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter =
      line[index + 1];

    if (
      character === '"' &&
      inQuotes &&
      nextCharacter === '"'
    ) {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (
      character === ',' &&
      !inQuotes
    ) {
      values.push(
        current.trim(),
      );
      current = '';
      continue;
    }

    current += character;
  }

  values.push(
    current.trim(),
  );

  return values;
}

async function createCsvProfile(file) {
  const sampleSize =
    Math.min(
      file.size,
      64 * 1024,
    );

  const text =
    await file
      .slice(0, sampleSize)
      .text();

  const lines =
    text
      .split(/\r?\n/)
      .filter((line) => line.trim());

  const header =
    parseCsvLine(
      lines[0] || '',
    ).filter(Boolean);

  const sampledRows =
    Math.max(
      lines.length - 1,
      0,
    );

  const estimatedRows =
    sampleSize > 0 && sampledRows > 0
      ? Math.max(
          sampledRows,
          Math.round(
            (sampledRows *
              file.size) /
              sampleSize,
          ),
        )
      : 0;

  return {
    columnCount:
      header.length,
    headers:
      header.slice(0, 8),
    estimatedRows,
    sampledRows,
  };
}

export default function UploadPage() {
  const navigate =
    useNavigate();

  const [
    uploadConfig,
    setUploadConfig,
  ] = useState(null);

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);

  const [
    status,
    setStatus,
  ] = useState('idle');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState(0);

  const [
    csvProfile,
    setCsvProfile,
  ] = useState(null);

  const [
    profileStatus,
    setProfileStatus,
  ] = useState('idle');

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const config =
          await getUploadConfig();

        if (active) {
          setUploadConfig(
            config,
          );
        }
      } catch {
        if (active) {
          setUploadConfig(
            null,
          );
        }
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  const chooseFile =
    useCallback(
      async (file) => {
        const validationError =
          validateSelectedFile(
            file,
            uploadConfig
              ?.maxFileSizeBytes,
          );

        if (validationError) {
          setSelectedFile(
            null,
          );

          setStatus('error');

          setErrorMessage(
            validationError,
          );

          return;
        }

        setSelectedFile(file);
        setStatus('idle');
        setErrorMessage('');
        setUploadProgress(0);
        setCsvProfile(null);
        setProfileStatus('loading');

        try {
          const profile =
            await createCsvProfile(file);

          setCsvProfile(profile);
          setProfileStatus('ready');
        } catch {
          setProfileStatus('error');
        }
      },
      [uploadConfig],
    );

  function handleDropRejected(
    rejection,
  ) {
    const firstError =
      rejection?.errors?.[0];

    if (
      firstError?.code ===
      'file-too-large'
    ) {
      setErrorMessage(
        `The selected file exceeds the ${formatBytes(
          uploadConfig
            ?.maxFileSizeBytes,
        )} limit.`,
      );
    } else {
      setErrorMessage(
        'Only one valid CSV file can be uploaded at a time.',
      );
    }

    setStatus('error');
  }

  function removeFile() {
    if (
      status ===
      'uploading'
    ) {
      return;
    }

    setSelectedFile(null);
    setStatus('idle');
    setErrorMessage('');
    setUploadProgress(0);
    setCsvProfile(null);
    setProfileStatus('idle');
  }

  async function startUpload() {
    if (
      status ===
      'uploading'
    ) {
      return;
    }

    const validationError =
      validateSelectedFile(
        selectedFile,
        uploadConfig
          ?.maxFileSizeBytes,
      );

    if (validationError) {
      setStatus('error');

      setErrorMessage(
        validationError,
      );

      return;
    }

    setStatus('uploading');
    setErrorMessage('');
    setUploadProgress(0);

    try {
      const result =
        await uploadCsv(
          selectedFile,
          ({
            percentage,
          }) => {
            setUploadProgress(
              percentage,
            );
          },
        );

      setUploadProgress(100);

      navigate(
        `/imports/${result.uploadId}/preview`,
      );
    } catch (error) {
      setStatus('error');

      setErrorMessage(
        getApiErrorMessage(
          error,
        ),
      );
    }
  }

  return (
    <div className="upload-page">
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">
            DATASET INGESTION
          </p>

          <h1>
            New import
          </h1>

          <p>
            Stage a CSV dataset
            securely before inspecting
            its structure and configuring
            your ETL pipeline.
          </p>
        </div>

        <div className="streaming-note">
          <ShieldCheck
            size={18}
          />

          <div>
            <strong>
              Streaming upload
            </strong>

            <span>
              Files are written
              incrementally instead of
              being loaded fully into
              Node.js memory.
            </span>
          </div>
        </div>
      </div>

      <section className="import-panel">
        <div className="panel-header">
          <div>
            <span className="step-number">
              01
            </span>

            <div>
              <h2>
                Select dataset
              </h2>

              <p>
                Upload one CSV file.
                Validation is repeated
                securely by the backend.
              </p>
            </div>
          </div>
        </div>

        {!selectedFile && (
          <UploadDropzone
            maxFileSize={
              uploadConfig
                ?.maxFileSizeBytes
            }
            disabled={
              status ===
              'uploading'
            }
            onAcceptedFile={
              chooseFile
            }
            onRejectedFile={
              handleDropRejected
            }
          />
        )}

        {selectedFile && (
          <>
            <SelectedFileCard
              file={
                selectedFile
              }
              disabled={
                status ===
                'uploading'
              }
              onRemove={
                removeFile
              }
            />

            <div className="csv-profile">
              <div className="csv-profile-header">
                <div>
                  <span>
                    Quick profile
                  </span>

                  <strong>
                    {profileStatus ===
                    'loading'
                      ? 'Reading CSV header...'
                      : 'Ready before upload'}
                  </strong>
                </div>
              </div>

              {profileStatus ===
                'ready' &&
                csvProfile && (
                  <>
                    <dl className="csv-profile-metrics">
                      <div>
                        <dt>
                          Columns
                        </dt>

                        <dd>
                          {
                            csvProfile.columnCount
                          }
                        </dd>
                      </div>

                      <div>
                        <dt>
                          Estimated rows
                        </dt>

                        <dd>
                          {csvProfile.estimatedRows.toLocaleString()}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          Sampled rows
                        </dt>

                        <dd>
                          {csvProfile.sampledRows.toLocaleString()}
                        </dd>
                      </div>
                    </dl>

                    {csvProfile.headers
                      .length > 0 && (
                      <div className="csv-header-preview">
                        {csvProfile.headers.map(
                          (header) => (
                            <span
                              key={
                                header
                              }
                            >
                              {header}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </>
                )}

              {profileStatus ===
                'error' && (
                <p className="csv-profile-message">
                  StreamWeaver could not
                  read a local header
                  sample, but the upload
                  can still continue.
                </p>
              )}
            </div>

            {status ===
              'uploading' && (
              <div className="upload-progress">
                <div className="progress-heading">
                  <span>
                    Uploading dataset
                  </span>

                  <strong>
                    {uploadProgress}%
                  </strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-value"
                    style={{
                      width:
                        `${uploadProgress}%`,
                    }}
                  />
                </div>

                <small>
                  Keep this page open
                  until the transfer
                  completes.
                </small>
              </div>
            )}

            <div className="upload-actions">
              <button
                type="button"
                className="primary-button"
                onClick={
                  startUpload
                }
                disabled={
                  status ===
                  'uploading'
                }
              >
                {status ===
                'uploading' ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="spin"
                    />

                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload
                      size={17}
                    />

                    Upload & preview
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {status ===
          'error' && (
          <div
            className="message-panel error-panel"
            role="alert"
          >
            <strong>
              Upload failed
            </strong>

            <p>
              {errorMessage}
            </p>

            {selectedFile && (
              <button
                type="button"
                className="secondary-button"
                onClick={
                  startUpload
                }
              >
                <RefreshCw
                  size={16}
                />

                Retry upload
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
