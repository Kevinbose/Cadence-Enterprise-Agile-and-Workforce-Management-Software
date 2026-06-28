import axios from 'axios';
import API_BASE_URL from '../../config/api';

const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const loginUser = async (credentials) => {
  const { data } = await authApi.post('/auth/login', credentials);
  return data;
};

export const registerUser = async (userData) => {
  const { data } = await authApi.post('/auth/register', userData);
  return data;
};

export const logoutUser = async () => {
  const { data } = await authApi.post('/auth/logout');
  return data;
};

export default authApi;
