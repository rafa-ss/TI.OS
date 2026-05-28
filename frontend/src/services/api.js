import axios from 'axios';
import toast from 'react-hot-toast';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({ baseURL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('os_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message || 'Erro inesperado';
    if (status === 401) {
      localStorage.removeItem('os_token');
      if (!window.location.pathname.startsWith('/login')) {
        toast.error('Sessão expirada. Faça login novamente.');
        setTimeout(() => (window.location.href = '/login'), 600);
      }
    } else if (status >= 500) {
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

export default api;
