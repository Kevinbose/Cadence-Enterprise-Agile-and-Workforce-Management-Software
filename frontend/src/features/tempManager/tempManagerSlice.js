import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchTeamGrantsRequest,
  assignTempManagerRequest,
  revokeTempManagerRequest,
} from './tempManagerService';

const extractError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

export const fetchTeamGrants = createAsyncThunk(
  'tempManager/fetchTeamGrants',
  async (_, thunkAPI) => {
    try {
      return await fetchTeamGrantsRequest();
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to load team delegation status')
      );
    }
  }
);

export const assignTempManager = createAsyncThunk(
  'tempManager/assignTempManager',
  async (payload, thunkAPI) => {
    try {
      const result = await assignTempManagerRequest(payload);
      thunkAPI.dispatch(fetchTeamGrants());
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to assign temporary manager')
      );
    }
  }
);

export const revokeTempManager = createAsyncThunk(
  'tempManager/revokeTempManager',
  async (grantId, thunkAPI) => {
    try {
      const result = await revokeTempManagerRequest(grantId);
      thunkAPI.dispatch(fetchTeamGrants());
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to revoke delegation')
      );
    }
  }
);

const tempManagerSlice = createSlice({
  name: 'tempManager',
  initialState: {
    teamList: [],
    activeGrant: null,
    isLoading: false,
    isSubmitting: false,
    error: null,
  },
  reducers: {
    clearTempManagerError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeamGrants.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamGrants.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teamList = action.payload.teamList || [];
        state.activeGrant = action.payload.activeGrant || null;
      })
      .addCase(fetchTeamGrants.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(assignTempManager.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(assignTempManager.fulfilled, (state) => {
        state.isSubmitting = false;
      })
      .addCase(assignTempManager.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })
      .addCase(revokeTempManager.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(revokeTempManager.fulfilled, (state) => {
        state.isSubmitting = false;
      })
      .addCase(revokeTempManager.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });
  },
});

export const { clearTempManagerError } = tempManagerSlice.actions;
export default tempManagerSlice.reducer;
