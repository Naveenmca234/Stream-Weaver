import {
  Download,
  FilePlus,
  Upload,
} from 'lucide-react';

import {
  useDropzone,
} from 'react-dropzone';

import {
  formatBytes,
} from '../../utils/formatBytes';

export default function UploadDropzone({
  maxFileSize,
  sampleFileUrl,
  disabled,
  onAcceptedFile,
  onRejectedFile,
  onUseSampleFile,
}) {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open,
  } = useDropzone({
    noClick: true,
    noKeyboard: false,
    multiple: false,
    maxFiles: 1,
    disabled,

    ...(maxFileSize
      ? {
          maxSize: maxFileSize,
        }
      : {}),

    accept: {
      'text/csv': [
        '.csv',
      ],

      'text/plain': [
        '.csv',
      ],

      'application/vnd.ms-excel': [
        '.csv',
      ],

      'application/octet-stream': [
        '.csv',
      ],
    },

    onDropAccepted(files) {
      if (files[0]) {
        onAcceptedFile(files[0]);
      }
    },

    onDropRejected(rejections) {
      onRejectedFile(rejections[0]);
    },
  });

  return (
    <div
      {...getRootProps({
        className: `upload-dropzone ${
          isDragActive
            ? 'dragging'
            : ''
        }`,
        'aria-label': 'CSV file upload area',
      })}
    >
      <input
        {...getInputProps({
          'aria-label': 'Choose a CSV file',
        })}
      />

      <div className="upload-symbol">
        <Upload size={26} />
      </div>

      <h2>
        Drop your CSV file here
      </h2>

      <p>
        The browser sends the file
        directly to StreamWeaver&apos;s
        upload pipeline for preview.
      </p>

      <div className="upload-choice-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={open}
          disabled={disabled}
        >
          Browse files
        </button>

        {sampleFileUrl && (
          <button
            type="button"
            className="secondary-button"
            onClick={onUseSampleFile}
            disabled={disabled}
          >
            <FilePlus size={15} />
            Use sample CSV
          </button>
        )}
      </div>

      {sampleFileUrl && (
        <a
          className="sample-download-link"
          href={sampleFileUrl}
          download
        >
          <Download size={15} />
          Download sample CSV
        </a>
      )}

      <div className="upload-rules">
        <span>CSV only</span>

        <span aria-hidden="true">
          -
        </span>

        <span>
          {maxFileSize
            ? `Maximum ${formatBytes(
                maxFileSize,
              )}`
            : 'Server-enforced size limit'}
        </span>
      </div>
    </div>
  );
}