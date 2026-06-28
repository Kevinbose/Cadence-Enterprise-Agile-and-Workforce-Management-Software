import axios from 'axios';
import API_BASE_URL from '../../config/api';

const kanbanApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const fetchTasks = async () => {
  const { data } = await kanbanApi.get('/tasks');
  return data;
};

export const createTask = async (taskData) => {
  const { data } = await kanbanApi.post('/tasks', taskData);
  return data;
};

export const updateTaskStatus = async ({ taskId, status }) => {
  const { data } = await kanbanApi.patch(`/tasks/${taskId}/status`, { status });
  return data;
};

export default kanbanApi;
