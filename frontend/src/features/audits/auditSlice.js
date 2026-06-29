import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getSprintAuditsRequest } from './auditService';

const extractError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

export const fetchSprintAudits = createAsyncThunk(
  'audit/fetchSprintAudits',
  async (sprintId, thunkAPI) => {
    try {
      return await getSprintAuditsRequest(sprintId);
    } catch (error) {
      return thunkAPI.rejectWithValue(extractError(error, 'Failed to load audit logs'));
    }
  }
);

const auditSlice = createSlice({
  name: 'audit',
  initialState: {
    logs: [],
    selectedSprint: null,
    isLoading: false,
    error: null,
  },
  reducers: {
    clearAuditError: (state) => { state.error = null; },
    clearAuditLogs: (state) => { state.logs = []; state.selectedSprint = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSprintAudits.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSprintAudits.fulfilled, (state, action) => {
        state.isLoading = false;
        state.logs = action.payload.logs || [];
        state.selectedSprint = action.payload.sprint || null;
      })
      .addCase(fetchSprintAudits.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearAuditError, clearAuditLogs } = auditSlice.actions;
export default auditSlice.reducer;
