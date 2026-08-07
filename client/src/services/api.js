import axios from 'axios';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000/api',
  timeout: 5000,
});

export async function getHealthStatus() {
  const response = await api.get('/health');
  return response.data;
}

export default api;