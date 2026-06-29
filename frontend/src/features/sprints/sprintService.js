import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const sprintApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

sprintApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export const getAllSprintsRequest = async () => {
  const { data } = await sprintApi.get('/sprints');
  return data;
};

export const createSprintRequest = async (payload) => {
  const { data } = await sprintApi.post('/sprints', payload);
  return data;
};

export const startSprintRequest = async (sprintId) => {
  const { data } = await sprintApi.patch(`/sprints/${sprintId}/start`);
  return data;
};

export const assignScrumMasterRequest = async (sprintId, scrumMasterId) => {
  const { data } = await sprintApi.patch(`/sprints/${sprintId}/scrummaster`, {
    scrumMasterId,
  });
  return data;
};

export const editSprintRequest = async (id, payload) => {
  const { data } = await sprintApi.patch(`/sprints/${id}/edit`, payload);
  return data;
};

export default sprintApi;
