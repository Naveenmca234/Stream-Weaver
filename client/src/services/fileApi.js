import api from './api';

export async function getUploadConfig() {
  const response = await api.get('/files/config');
  return response.data.data;
}

export async function uploadCsv(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post(
    '/files/upload',
    formData,
    {
      timeout: 0,
      onUploadProgress: (progressEvent) => {
        if (typeof onProgress !== 'function') {
          return;
        }

        const total =
          progressEvent.total ||
          file.size ||
          0;

        const loaded =
          progressEvent.loaded || 0;

        const percentage = total > 0
          ? Math.min(
              100,
              Math.round((loaded / total) * 100),
            )
          : 0;

        onProgress({
          loaded,
          total,
          percentage,
        });
      },
    },
  );

  return response.data.data;
}

export async function getCsvPreview(uploadId) {
  const response = await api.get(
    `/files/${encodeURIComponent(uploadId)}/preview`,
  );

  return response.data.data;
}

export async function previewCsvMapping(uploadId, mappings) {
  const response = await api.post(
    `/files/${encodeURIComponent(uploadId)}/mapping/preview`,
    { mappings },
  );

  return response.data.data;
}
