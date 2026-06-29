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

export const fetchWorkforceSummaryRequest = async () => {
  const { data } = await intelligenceApi.get('/intelligence/workforce');
  return data;
};

export const fetchEmployeeDossierRequest = async (userId) => {
  const { data } = await intelligenceApi.get(`/intelligence/dossier/${userId}`);
  return data;
};

export default intelligenceApi;
