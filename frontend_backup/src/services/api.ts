import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sw_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('sw_refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('sw_access_token', data.accessToken);
        localStorage.setItem('sw_refresh_token', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('sw_access_token');
        localStorage.removeItem('sw_refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// --- Auth ---
export const authApi = {
  register: (data: { email: string; password: string; name: string; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
};

// --- Datasets ---
export const datasetsApi = {
  upload: (formData: FormData, onProgress?: (pct: number) => void) =>
    api.post('/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),
  list: (page = 1, limit = 20) =>
    api.get('/datasets', { params: { page, limit } }),
  get: (id: string) => api.get(`/datasets/${id}`),
  getSchema: (id: string) => api.get(`/datasets/${id}/schema`),
  updateSchema: (id: string, fields: unknown[]) =>
    api.patch(`/datasets/${id}/schema`, { fields }),
  getPreview: (id: string, rows = 1000) =>
    api.get(`/datasets/${id}/preview`, { params: { rows } }),
  delete: (id: string) => api.delete(`/datasets/${id}`),
};

// --- Pipelines ---
export const pipelinesApi = {
  create: (data: unknown) => api.post('/pipelines', data),
  list: (page = 1, limit = 20) =>
    api.get('/pipelines', { params: { page, limit } }),
  get: (id: string) => api.get(`/pipelines/${id}`),
  update: (id: string, data: unknown) => api.put(`/pipelines/${id}`, data),
  validate: (id: string, graph: unknown) =>
    api.post(`/pipelines/${id}/validate`, { graph }),
  publish: (id: string, notes?: string) =>
    api.post(`/pipelines/${id}/publish`, { notes }),
  getVersions: (id: string) => api.get(`/pipelines/${id}/versions`),
  rollback: (id: string, version: number) =>
    api.post(`/pipelines/${id}/rollback`, { version }),
  delete: (id: string) => api.delete(`/pipelines/${id}`),
};

// --- Runs ---
export const runsApi = {
  create: (data: { pipelineId: string; pipelineVersionId: string; datasetId: string }) =>
    api.post('/runs', data),
  list: (params?: Record<string, unknown>) =>
    api.get('/runs', { params }),
  get: (id: string) => api.get(`/runs/${id}`),
  cancel: (id: string) => api.post(`/runs/${id}/cancel`),
  getErrors: (id: string, page = 1, limit = 50, stage?: string) =>
    api.get(`/runs/${id}/errors`, { params: { page, limit, stage } }),
};

// --- Monitoring ---
export const monitoringApi = {
  getMetrics: () => api.get('/monitoring'),
  getHealth: () => api.get('/health'),
  getAuditLogs: (params?: Record<string, unknown>) =>
    api.get('/audit-logs', { params }),
};

// --- Connections ---
export const connectionsApi = {
  list: () => api.get('/connections'),
  create: (data: unknown) => api.post('/connections', data),
  test: (id: string) => api.post(`/connections/${id}/test`),
  delete: (id: string) => api.delete(`/connections/${id}`),
};

// --- Sandbox ---
export const sandboxApi = {
  execute: (code: string, value: unknown, record?: Record<string, unknown>) =>
    api.post('/sandbox/execute', { code, value, record }),
  validate: (code: string) => api.post('/sandbox/validate', { code }),
};

// --- Schedules ---
export const schedulesApi = {
  list: () => api.get('/schedules'),
  create: (data: unknown) => api.post('/schedules', data),
  update: (id: string, data: unknown) => api.put(`/schedules/${id}`, data),
  delete: (id: string) => api.delete(`/schedules/${id}`),
};

// --- Demo ---
export const demoApi = {
  generate: (type: string, count: number) =>
    `/api/demo/generate?type=${type}&count=${count}`,
};
