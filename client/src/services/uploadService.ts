import api from './api';
import * as tus from 'tus-js-client';

export interface UploadResult {
  message: string;
  fileName: string;
  total: number;
  totalRows?: number;
  failedRows?: number;
  preview: Array<Record<string, unknown>>;
  columns?: string[];
  jobId: string;
}

const uploadFile = async (file: File, clientUploadId: string, onProgress?: (bytesSent: number, bytesTotal: number) => void): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: '/uploads',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: file.name,
        filetype: file.type
      },
      onError: (error) => {
        console.error('Tus upload failed:', error);
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress) onProgress(bytesUploaded, bytesTotal);
      },
      onSuccess: async () => {
        try {
          const urlParts = upload.url?.split('/') || [];
          const tusFileId = urlParts[urlParts.length - 1];

          const response = await api.post<UploadResult>('/uploads/finalize', {
            tusFileId,
            fileName: file.name,
            clientUploadId
          });
          resolve(response.data);
        } catch (error) {
          reject(error);
        }
      }
    });

    upload.start();
  });
};

export default uploadFile;
