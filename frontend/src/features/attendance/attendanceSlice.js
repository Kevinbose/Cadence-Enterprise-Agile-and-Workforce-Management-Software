import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  punchInRequest,
  pauseShiftRequest,
  resumeShiftRequest,
  punchOutRequest,
  fetchTodayStatusRequest,
  regularizeShiftRequest,
} from './attendanceService';

// ── Initial State ─────────────────────────────────────────────────────────────
const initialState = {
  // Today's attendance record (if any)
  todayRecord: null,
  // Outstanding system-auto-closed record requiring justification reason (if any)
  pendingRegularizationRecord: null,
  isLoading: false,
  isClockingIn: false,
  error: null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

/** Morning GPS punch-in */
export const punchInUser = createAsyncThunk(
  'attendance/punchIn',
  async ({ lat, lng }, thunkAPI) => {
    try {
      const response = await punchInRequest(lat, lng);
      if (!response.success) return thunkAPI.rejectWithValue(response.message);
      return response.record;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message || 'Punch-in failed.'
      );
    }
  }
);

/** Pause active session (accumulate chunk hours) */
export const pauseShiftUser = createAsyncThunk(
  'attendance/pauseShift',
  async (_, thunkAPI) => {
    try {
      const response = await pauseShiftRequest();
      if (!response.success) return thunkAPI.rejectWithValue(response.message);
      return response.record;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message || 'Pause failed.'
      );
    }
  }
);

/** Resume paused session (start new chunk) */
export const resumeShiftUser = createAsyncThunk(
  'attendance/resumeShift',
  async (_, thunkAPI) => {
    try {
      const response = await resumeShiftRequest();
      if (!response.success) return thunkAPI.rejectWithValue(response.message);
      return response.record;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message || 'Resume failed.'
      );
    }
  }
);

/** End Day Completely — seal the ledger */
export const punchOutUser = createAsyncThunk(
  'attendance/punchOut',
  async (_, thunkAPI) => {
    try {
      const response = await punchOutRequest();
      if (!response.success) return thunkAPI.rejectWithValue(response.message);
      return response.record;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message || 'End day failed.'
      );
    }
  }
);

/** Page-refresh rehydration */
export const fetchTodayStatus = createAsyncThunk(
  'attendance/fetchTodayStatus',
  async (_, thunkAPI) => {
    try {
      const response = await fetchTodayStatusRequest();
      if (!response.success) return thunkAPI.rejectWithValue(response.message);
      return {
        record: response.record,
        pendingRegularization: response.pendingRegularization,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch status.'
      );
    }
  }
);

/** Submit justification reason for an auto-closed shift */
export const regularizeShiftUser = createAsyncThunk(
  'attendance/regularizeShift',
  async ({ reason }, thunkAPI) => {
    try {
      const response = await regularizeShiftRequest(reason);
      if (!response.success) return thunkAPI.rejectWithValue(response.message);
      return response.record;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || error.message || 'Regularization failed.'
      );
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    clearAttendanceError: (state) => {
      state.error = null;
    },
    resetAttendanceState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ── punchIn ──────────────────────────────────────────────────────────
      .addCase(punchInUser.pending, (state) => {
        state.isClockingIn = true;
        state.error = null;
      })
      .addCase(punchInUser.fulfilled, (state, action) => {
        state.isClockingIn = false;
        state.todayRecord = action.payload;
      })
      .addCase(punchInUser.rejected, (state, action) => {
        state.isClockingIn = false;
        state.error = action.payload;
      })

      // ── pauseShift ───────────────────────────────────────────────────────
      .addCase(pauseShiftUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(pauseShiftUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.todayRecord = action.payload;
      })
      .addCase(pauseShiftUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ── resumeShift ──────────────────────────────────────────────────────
      .addCase(resumeShiftUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resumeShiftUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.todayRecord = action.payload;
      })
      .addCase(resumeShiftUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ── punchOut (End Day) ───────────────────────────────────────────────
      .addCase(punchOutUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(punchOutUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.todayRecord = action.payload;
      })
      .addCase(punchOutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ── fetchTodayStatus (rehydration) ───────────────────────────────────
      .addCase(fetchTodayStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTodayStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.todayRecord = action.payload.record;
        state.pendingRegularizationRecord = action.payload.pendingRegularization;
      })
      .addCase(fetchTodayStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ── regularizeShift ──────────────────────────────────────────────────
      .addCase(regularizeShiftUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(regularizeShiftUser.fulfilled, (state) => {
        state.isLoading = false;
        // Unlocked! Clear hostage record
        state.pendingRegularizationRecord = null;
      })
      .addCase(regularizeShiftUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearAttendanceError, resetAttendanceState } =
  attendanceSlice.actions;

export default attendanceSlice.reducer;
