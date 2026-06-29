import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const attendanceApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── JWT Request Interceptor ───────────────────────────────────────────────────
attendanceApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── API Functions ─────────────────────────────────────────────────────────────

/** POST /api/v1/attendance/punch-in */
export const punchInRequest = async (lat, lng) => {
  const { data } = await attendanceApi.post('/attendance/punch-in', { lat, lng });
  return data;
};

/** PATCH /api/v1/attendance/pause */
export const pauseShiftRequest = async () => {
  const { data } = await attendanceApi.patch('/attendance/pause');
  return data;
};

/** PATCH /api/v1/attendance/resume */
export const resumeShiftRequest = async () => {
  const { data } = await attendanceApi.patch('/attendance/resume');
  return data;
};

/** PUT /api/v1/attendance/punch-out (End Day Completely) */
export const punchOutRequest = async () => {
  const { data } = await attendanceApi.put('/attendance/punch-out');
  return data;
};

/** GET /api/v1/attendance/today (Page-refresh rehydration) */
export const fetchTodayStatusRequest = async () => {
  const { data } = await attendanceApi.get('/attendance/today');
  return data;
};

/** PATCH /api/v1/attendance/regularize */
export const regularizeShiftRequest = async (reason) => {
  const { data } = await attendanceApi.patch('/attendance/regularize', { reason });
  return data;
};

export default attendanceApi;
