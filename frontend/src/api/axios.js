import axios from 'axios';

const api = axios.create({
  // Relative path works both locally (Vite proxies /api → 5001) and via Tailscale Funnel
  // (where / → 5173 and /api → 5001 share the same origin).
  // Override with VITE_API_URL for production deploys.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Send httpOnly cookies automatically
});

export default api;