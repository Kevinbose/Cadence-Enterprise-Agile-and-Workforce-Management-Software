import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchWorkforceSummaryRequest,
  fetchEmployeeDossierRequest,
} from './intelligenceService';

const extractError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

/* ── Thunks ──────────────────────────────────────────────────────────────── */
export const fetchWorkforceSummary = createAsyncThunk(
  'intelligence/fetchWorkforceSummary',
  async (_, thunkAPI) => {
    try {
      return await fetchWorkforceSummaryRequest();
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to load workforce summary')
      );
    }
  }
);

export const fetchEmployeeDossier = createAsyncThunk(
  'intelligence/fetchEmployeeDossier',
  async (userId, thunkAPI) => {
    try {
      return await fetchEmployeeDossierRequest(userId);
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to load employee dossier')
      );
    }
  }
);

/* ── Derive ticker feed from workforce array ─────────────────────────────── */
const buildTickerFeed = (workforce) => {
  const events = [];
  workforce.forEach((emp) => {
    if (emp.trustScore < 75) {
      events.push({
        id:    `ts-${emp.id}`,
        type:  'LOW_SCORE',
        label: `LOW SCORE`,
        text:  `${emp.name} trust score is ${emp.trustScore}`,
        score: emp.trustScore,
      });
    }
    if (emp.gtp >= 3) {
      events.push({
        id:    `gtp-${emp.id}`,
        type:  'TAMPER',
        label: `TAMPER`,
        text:  `${emp.gtp} goalpost shifts detected for ${emp.name}`,
        score: emp.trustScore,
      });
    }
    if (emp.ari < 80) {
      events.push({
        id:    `ari-${emp.id}`,
        type:  'ATTENDANCE',
        label: `ATTENDANCE`,
        text:  `${emp.name} ARI is ${emp.ari}% (below 80%)`,
        score: emp.trustScore,
      });
    }
  });
  return events.sort((a, b) => a.score - b.score);
};

/* ── Slice ───────────────────────────────────────────────────────────────── */
const intelligenceSlice = createSlice({
  name: 'intelligence',
  initialState: {
    workforce:       [],
    selectedDossier: null,
    isLoading:       false,
    isDossierLoading: false,
    tickerFeed:      [],
    error:           null,
  },
  reducers: {
    clearDossier: (state) => { state.selectedDossier = null; },
    clearIntelligenceError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      /* workforce summary */
      .addCase(fetchWorkforceSummary.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWorkforceSummary.fulfilled, (state, action) => {
        state.isLoading  = false;
        state.workforce  = action.payload.workforce || [];
        state.tickerFeed = buildTickerFeed(state.workforce);
      })
      .addCase(fetchWorkforceSummary.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      /* employee dossier */
      .addCase(fetchEmployeeDossier.pending, (state) => {
        state.isDossierLoading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeDossier.fulfilled, (state, action) => {
        state.isDossierLoading = false;
        state.selectedDossier  = action.payload;
      })
      .addCase(fetchEmployeeDossier.rejected, (state, action) => {
        state.isDossierLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearDossier, clearIntelligenceError } = intelligenceSlice.actions;
export default intelligenceSlice.reducer;
