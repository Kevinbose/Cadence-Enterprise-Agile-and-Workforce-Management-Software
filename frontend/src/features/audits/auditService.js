import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const auditApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

auditApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export const getSprintAuditsRequest = async (sprintId) => {
  const { data } = await auditApi.get(`/audits/sprints/${sprintId}`);
  return data;
};

export default auditApi;
