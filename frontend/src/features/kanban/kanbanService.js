import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const kanbanApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

kanbanApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getBoardRequest = async (sprintId) => {
  const url = sprintId ? `/tasks/board?sprintId=${sprintId}` : '/tasks/board';
  const { data } = await kanbanApi.get(url);
  return data;
};

export const createIssueRequest = async (payload) => {
  const { data } = await kanbanApi.post('/tasks', payload);
  return data;
};

export const updateTaskStatusRequest = async ({ taskId, status }) => {
  const { data } = await kanbanApi.patch(`/tasks/${taskId}/status`, { status });
  return data;
};

export const rejectTaskRequest = async ({ taskId, rejectionReason }) => {
  const { data } = await kanbanApi.patch(`/tasks/${taskId}/reject`, {
    rejectionReason,
  });
  return data;
};

export const getEligibleAssigneesRequest = async () => {
  const { data } = await kanbanApi.get('/users/assignees');
  return data;
};

export const editIssueRequest = async (id, payload) => {
  const { data } = await kanbanApi.patch(`/tasks/${id}`, payload);
  return data;
};

export const deleteIssueRequest = async (id) => {
  const { data } = await kanbanApi.delete(`/tasks/${id}`);
  return data;
};

export const bulkAdjudicateRequest = async ({ taskIds, action, comment }) => {
  const { data } = await kanbanApi.post('/tasks/bulk-adjudicate', {
    taskIds,
    action,
    comment,
  });
  return data;
};

export default kanbanApi;
