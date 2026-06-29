import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getAllSprintsRequest,
  createSprintRequest,
  startSprintRequest,
  assignScrumMasterRequest,
  editSprintRequest,
} from './sprintService';

const extractError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchAllSprints = createAsyncThunk(
  'sprint/fetchAll',
  async (_, thunkAPI) => {
    try {
      return await getAllSprintsRequest();
    } catch (error) {
      return thunkAPI.rejectWithValue(extractError(error, 'Failed to load sprints'));
    }
  }
);

export const createSprint = createAsyncThunk(
  'sprint/create',
  async (payload, thunkAPI) => {
    try {
      const data = await createSprintRequest(payload);
      thunkAPI.dispatch(fetchAllSprints()); // Refresh list
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(extractError(error, 'Failed to create sprint'));
    }
  }
);

export const startSprint = createAsyncThunk(
  'sprint/start',
  async (sprintId, thunkAPI) => {
    try {
      const data = await startSprintRequest(sprintId);
      thunkAPI.dispatch(fetchAllSprints()); // Refresh list
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(extractError(error, 'Failed to start sprint'));
    }
  }
);

export const assignScrumMaster = createAsyncThunk(
  'sprint/assignScrumMaster',
  async ({ sprintId, scrumMasterId }, thunkAPI) => {
    try {
      const data = await assignScrumMasterRequest(sprintId, scrumMasterId);
      thunkAPI.dispatch(fetchAllSprints()); // Refresh list
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(extractError(error, 'Failed to assign Scrum Master'));
    }
  }
);

export const editSprint = createAsyncThunk(
  'sprint/edit',
  async ({ id, data: payload }, thunkAPI) => {
    try {
      return await editSprintRequest(id, payload);
    } catch (error) {
      return thunkAPI.rejectWithValue(extractError(error, 'Failed to update sprint'));
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const sprintSlice = createSlice({
  name: 'sprint',
  initialState: {
    sprints: [],
    isLoading: false,
    isSubmitting: false,
    error: null,
  },
  reducers: {
    clearSprintError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchAllSprints
      .addCase(fetchAllSprints.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllSprints.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sprints = action.payload.sprints || [];
      })
      .addCase(fetchAllSprints.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // createSprint
      .addCase(createSprint.pending, (state) => { state.isSubmitting = true; state.error = null; })
      .addCase(createSprint.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(createSprint.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload; })

      // startSprint
      .addCase(startSprint.pending, (state) => { state.isSubmitting = true; state.error = null; })
      .addCase(startSprint.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(startSprint.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload; })

      // assignScrumMaster
      .addCase(assignScrumMaster.pending, (state) => { state.isSubmitting = true; state.error = null; })
      .addCase(assignScrumMaster.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(assignScrumMaster.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload; })

      // editSprint
      .addCase(editSprint.pending, (state) => { state.isSubmitting = true; state.error = null; })
      .addCase(editSprint.fulfilled, (state, action) => {
        state.isSubmitting = false;
        const updated = action.payload.sprint;
        if (updated) {
          const idx = state.sprints.findIndex((s) => s.id === updated.id);
          if (idx !== -1) {
            state.sprints[idx] = updated;
          }
        }
      })
      .addCase(editSprint.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload; });
  },
});

export const { clearSprintError } = sprintSlice.actions;
export default sprintSlice.reducer;
