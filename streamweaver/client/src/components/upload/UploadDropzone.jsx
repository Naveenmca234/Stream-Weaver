import {
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
  disabled,
  onAcceptedFile,
  onRejectedFile,
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
          maxSize:
            maxFileSize,
        }
      : {}),

    accept: {
      'text/csv': [
        '.csv',
      ],

      'text/plain': [
        '.csv',
      ],

      'application/vnd.ms-excel':
        [
          '.csv',
        ],

      'application/octet-stream':
        [
          '.csv',
        ],
    },

    onDropAccepted(files) {
      if (files[0]) {
        onAcceptedFile(
          files[0],
        );
      }
    },

    onDropRejected(
      rejections,
    ) {
      onRejectedFile(
        rejections[0],
      );
    },
  });

  function handleOpen(event) {
    if (disabled) {
      return;
    }

    if (event?.stopPropagation) {
      event.stopPropagation();
    }

    open();
  }

  return (
    <div
      {...getRootProps({
        className:
          `upload-dropzone ${
            isDragActive
              ? 'dragging'
              : ''
          }`,
      })}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          event.preventDefault();
          handleOpen(event);
        }
      }}
    >
      <input
        {...getInputProps()}
      />

      <div className="upload-symbol">
        <Upload size={26} />
      </div>

      <h2>
        Drop your CSV file here
      </h2>

      <p>
        The browser sends the file
        directly to StreamWeaver's
        upload pipeline for preview.
      </p>

      <p className="upload-helper-text">
        One CSV file at a time.
      </p>

      <div
        className="upload-status-pill"
        style={{
          display: 'inline-block',
          marginTop: '0.5rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '999px',
          backgroundColor: '#f3f4f6',
          color: '#374151',
          fontSize: '0.8rem',
          fontWeight: 600,
          border: '1px solid #d1d5db',
        }}
      >
        Fast preview ready
      </div>

      <button
        type="button"
        className="secondary-button"
        onClick={handleOpen}
        disabled={disabled}
      >
        Choose CSV file
      </button>

      <div className="upload-rules">
        <span>CSV only</span>

        <span>•</span>

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