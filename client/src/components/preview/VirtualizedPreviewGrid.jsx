import {
  List,
} from 'react-window';

function getColumnWidth(
  label,
) {
  const estimated =
    String(label).length *
      8 +
    48;

  return Math.min(
    280,
    Math.max(
      160,
      estimated,
    ),
  );
}

function renderCellValue(
  value,
) {
  if (value === null) {
    return (
      <span className="null-value">
        NULL
      </span>
    );
  }

  if (value === '') {
    return (
      <span className="empty-value">
        — Empty
      </span>
    );
  }

  return value;
}

function PreviewRow({
  index,
  style,
  rows,
  columns,
  gridTemplateColumns,
}) {
  const row =
    rows[index];

  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns,
      }}
      className={
        `preview-data-row ${
          row.hasColumnMismatch
            ? 'row-warning'
            : ''
        }`
      }
    >
      <div
        className="preview-row-number"
        title={
          row.hasColumnMismatch
            ? 'This row contains a different number of fields than the header.'
            : undefined
        }
      >
        {row.rowNumber}

        {row.hasColumnMismatch && (
          <span
            className="row-warning-dot"
            aria-label="Column count mismatch"
          >
            !
          </span>
        )}
      </div>

      {columns.map(
        (column) => (
          <div
            key={
              column.key
            }
            className="preview-data-cell"
            title={
              row.values[
                column.index
              ] ?? ''
            }
          >
            {renderCellValue(
              row.values[
                column.index
              ],
            )}
          </div>
        ),
      )}
    </div>
  );
}

export default function VirtualizedPreviewGrid({
  columns,
  rows,
}) {
  if (
    !columns.length
  ) {
    return (
      <div className="preview-empty">
        No columns were detected.
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="preview-empty">
        The CSV contains headers but
        no data rows.
      </div>
    );
  }

  const columnWidths =
    columns.map(
      (column) =>
        getColumnWidth(
          column.label,
        ),
    );

  const gridTemplateColumns =
    [
      '64px',
      ...columnWidths.map(
        (width) =>
          `${width}px`,
      ),
    ].join(' ');

  const totalWidth =
    64 +
    columnWidths.reduce(
      (sum, width) =>
        sum + width,
      0,
    );

  return (
    <div
      className="preview-grid-horizontal"
      role="region"
      aria-label="Dataset preview"
      tabIndex={0}
    >
      <div
        className="preview-grid-canvas"
        style={{
          width:
            `${totalWidth}px`,
        }}
      >
        <div
          className="preview-header-row"
          style={{
            gridTemplateColumns,
          }}
        >
          <div className="preview-header-number">
            #
          </div>

          {columns.map(
            (column) => (
              <div
                key={
                  column.key
                }
                className="preview-header-cell"
                title={
                  column.originalLabel ||
                  column.label
                }
              >
                <strong>
                  {column.label}
                </strong>

                <span>
                  Column{' '}
                  {column.index +
                    1}
                </span>
              </div>
            ),
          )}
        </div>

        <List
          rowComponent={
            PreviewRow
          }
          rowCount={
            rows.length
          }
          rowHeight={44}
          rowProps={{
            rows,
            columns,
            gridTemplateColumns,
          }}
          style={{
            width:
              totalWidth,
            height: 520,
          }}
        />
      </div>
    </div>
  );
}