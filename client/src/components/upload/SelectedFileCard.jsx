import {
  FileText,
  X,
} from 'lucide-react';

import {
  formatBytes,
} from '../../utils/formatBytes';

export default function SelectedFileCard({
  file,
  disabled,
  onRemove,
}) {
  return (
    <div className="selected-file">
      <div className="file-icon">
        <FileText size={22} />
      </div>

      <div className="file-information">
        <strong>
          {file.name}
        </strong>

        <div>
          <span>
            {formatBytes(
              file.size,
            )}
          </span>

          <span>CSV</span>

          <span>
            {file.type ||
              'Detected by extension'}
          </span>
        </div>

        <span className="file-status-pill">
          Ready to upload
        </span>
      </div>

      <button
        type="button"
        className="icon-button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove selected file"
      >
        <X size={18} />
      </button>
    </div>
  );
}