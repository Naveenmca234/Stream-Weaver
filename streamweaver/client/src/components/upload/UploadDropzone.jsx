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

      <button
        type="button"
        className="secondary-button"
        onClick={open}
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