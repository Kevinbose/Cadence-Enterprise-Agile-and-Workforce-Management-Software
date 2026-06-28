import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  checkIn,
  checkOut,
  fetchAttendanceHistory,
} from './attendanceService';

const initialState = {
  records: [],
  todayStatus: null,
  isLoading: false,
  isError: false,
  message: '',
};

export const performCheckIn = createAsyncThunk(
  'attendance/checkIn',
  async (location, thunkAPI) => {
    try {
      return await checkIn(location);
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || 'Check-in failed';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const performCheckOut = createAsyncThunk(
  'attendance/checkOut',
  async (location, thunkAPI) => {
    try {
      return await checkOut(location);
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || 'Check-out failed';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const loadAttendanceHistory = createAsyncThunk(
  'attendance/history',
  async (_, thunkAPI) => {
    try {
      return await fetchAttendanceHistory();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to load attendance history';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    resetAttendance: (state) => {
      state.isLoading = false;
      state.isError = false;
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(performCheckIn.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(performCheckIn.fulfilled, (state, action) => {
        state.isLoading = false;
        state.todayStatus = action.payload;
      })
      .addCase(performCheckIn.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(performCheckOut.fulfilled, (state, action) => {
        state.isLoading = false;
        state.todayStatus = action.payload;
      })
      .addCase(loadAttendanceHistory.fulfilled, (state, action) => {
        state.records = action.payload;
      });
  },
});

export const { resetAttendance } = attendanceSlice.actions;
export default attendanceSlice.reducer;
