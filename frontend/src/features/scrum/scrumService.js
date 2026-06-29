import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const scrumApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

scrumApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getWfhQueueRequest = async () => {
  const { data } = await scrumApi.get('/scrum/wfh-queue');
  return data;
};

export const adjudicateWfhRequest = async (recordId, newStatus) => {
  const { data } = await scrumApi.patch(`/scrum/adjudicate/${recordId}`, {
    newStatus,
  });
  return data;
};

export const getTeamMatrixRequest = async () => {
  const { data } = await scrumApi.get('/scrum/team-matrix');
  return data;
};

export default scrumApi;
