import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getWfhQueueRequest,
  adjudicateWfhRequest,
  getTeamMatrixRequest,
} from './scrumService';

const initialState = {
  wfhQueue: [],
  teamMatrix: [],
  summary: null,
  sprintId: null,
  activeSprint: null,
  date: null,
  isLoading: false,
  error: null,
};

export const fetchWfhQueue = createAsyncThunk(
  'scrum/fetchWfhQueue',
  async (_, thunkAPI) => {
    try {
      const response = await getWfhQueueRequest();
      if (!response.success) {
        return thunkAPI.rejectWithValue(
          response.message || 'Failed to load WFH queue'
        );
      }
      return response;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to load WFH queue';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const adjudicateWfh = createAsyncThunk(
  'scrum/adjudicateWfh',
  async ({ recordId, newStatus, userId }, thunkAPI) => {
    try {
      const response = await adjudicateWfhRequest(recordId, newStatus, userId);
      if (!response.success) {
        return thunkAPI.rejectWithValue(
          response.message || 'Failed to adjudicate WFH request'
        );
      }
      return response;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to adjudicate WFH request';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchTeamMatrix = createAsyncThunk(
  'scrum/fetchTeamMatrix',
  async (_, thunkAPI) => {
    try {
      const response = await getTeamMatrixRequest();
      if (!response.success) {
        return thunkAPI.rejectWithValue(
          response.message || 'Failed to load team matrix'
        );
      }
      return response;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to load team matrix';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const scrumSlice = createSlice({
  name: 'scrum',
  initialState,
  reducers: {
    clearScrumError: (state) => {
      state.error = null;
    },
    resetScrumState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWfhQueue.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWfhQueue.fulfilled, (state, action) => {
        state.isLoading = false;
        state.wfhQueue = action.payload.queue;
        state.sprintId = action.payload.sprintId;
        state.activeSprint = action.payload.activeSprint || state.activeSprint;
        state.date = action.payload.date;
      })
      .addCase(fetchWfhQueue.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(adjudicateWfh.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(adjudicateWfh.fulfilled, (state, action) => {
        state.isLoading = false;
        const adjudicatedRecordId = action.payload.record.recordId;
        state.wfhQueue = state.wfhQueue.filter(
          (item) => item.recordId !== adjudicatedRecordId
        );
        const matrixIndex = state.teamMatrix.findIndex(
          (row) => row.employeeId === action.payload.record.employeeId
        );
        if (matrixIndex !== -1) {
          state.teamMatrix[matrixIndex].todayStatus =
            action.payload.record.newStatus;
          state.teamMatrix[matrixIndex].isStandupLocked =
            action.payload.record.newStatus === 'ABSENT' || state.teamMatrix[matrixIndex].isStandupLocked;
          if (state.teamMatrix[matrixIndex].attendance) {
            state.teamMatrix[matrixIndex].attendance.status =
              action.payload.record.newStatus;
            state.teamMatrix[matrixIndex].attendance.isStandupLocked =
              action.payload.record.newStatus === 'ABSENT' || state.teamMatrix[matrixIndex].attendance.isStandupLocked;
          }
        }
      })
      .addCase(adjudicateWfh.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchTeamMatrix.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamMatrix.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teamMatrix = action.payload.matrix;
        state.summary = action.payload.summary;
        state.sprintId = action.payload.sprintId;
        state.activeSprint = action.payload.activeSprint || state.activeSprint;
        state.date = action.payload.date;
      })
      .addCase(fetchTeamMatrix.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearScrumError, resetScrumState } = scrumSlice.actions;
export default scrumSlice.reducer;
