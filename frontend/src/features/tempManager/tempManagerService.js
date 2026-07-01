import axios from 'axios';
import API_BASE_URL from '../../config/api';

const TOKEN_KEY = 'token';

const tempManagerApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

tempManagerApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export const fetchTeamGrantsRequest = async () => {
  const { data } = await tempManagerApi.get('/temp-manager/team-status');
  return data;
};

export const assignTempManagerRequest = async ({ granteeId, startTime, endTime }) => {
  const { data } = await tempManagerApi.post('/temp-manager/grant', {
    granteeId,
    startTime,
    endTime,
  });
  return data;
};

export const revokeTempManagerRequest = async (grantId) => {
  const { data } = await tempManagerApi.patch(`/temp-manager/revoke/${grantId}`);
  return data;
};

export default tempManagerApi;
