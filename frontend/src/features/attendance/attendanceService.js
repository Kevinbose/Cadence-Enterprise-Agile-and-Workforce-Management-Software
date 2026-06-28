import axios from 'axios';
import API_BASE_URL from '../../config/api';

const attendanceApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const checkIn = async (location) => {
  const { data } = await attendanceApi.post('/attendance/check-in', location);
  return data;
};

export const checkOut = async (location) => {
  const { data } = await attendanceApi.post('/attendance/check-out', location);
  return data;
};

export const fetchAttendanceHistory = async () => {
  const { data } = await attendanceApi.get('/attendance/history');
  return data;
};

export default attendanceApi;
