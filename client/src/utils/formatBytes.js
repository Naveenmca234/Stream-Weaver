export function formatBytes(bytes) {
  if (
    bytes === null ||
    bytes === undefined
  ) {
    return 'Unknown';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ];

  const unitIndex = Math.min(
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    ),
    units.length - 1,
  );

  const value =
    bytes /
    1024 ** unitIndex;

  return `${value.toFixed(
    unitIndex === 0 ? 0 : 2,
  )} ${units[unitIndex]}`;
}