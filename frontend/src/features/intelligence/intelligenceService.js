import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const intelligenceApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

intelligenceApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

/* Backward-compatible: year/quarter are optional. When omitted, the backend
   returns full-history data identical to the pre-temporal version. */
export const fetchWorkforceSummaryRequest = async ({ year, quarter } = {}) => {
  const params = {};
  if (year)    params.year    = year;
  if (quarter) params.quarter = quarter;
  const { data } = await intelligenceApi.get('/intelligence/workforce', { params });
  return data;
};

export const fetchEmployeeDossierRequest = async ({ userId, year, quarter } = {}) => {
  const params = {};
  if (year)    params.year    = year;
  if (quarter) params.quarter = quarter;
  const { data } = await intelligenceApi.get(`/intelligence/dossier/${userId}`, { params });
  return data;
};

export const fetchYearlyAppraisalRequest = async (year) => {
  const { data } = await intelligenceApi.get('/intelligence/appraisal', { params: { year } });
  return data;
};

export default intelligenceApi;
