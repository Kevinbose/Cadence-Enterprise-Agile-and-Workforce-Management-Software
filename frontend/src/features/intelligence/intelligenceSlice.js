import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchWorkforceSummaryRequest,
  fetchEmployeeDossierRequest,
  fetchYearlyAppraisalRequest,
} from './intelligenceService';

const extractError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const currentYear    = new Date().getFullYear();
const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

/* ── Thunks ──────────────────────────────────────────────────────────────── */

/**
 * fetchWorkforceSummary — Tier 1 quarterly workforce grid.
 * Accepts { year, quarter } payload; both optional for backward compat.
 */
export const fetchWorkforceSummary = createAsyncThunk(
  'intelligence/fetchWorkforceSummary',
  async ({ year, quarter } = {}, thunkAPI) => {
    try {
      return await fetchWorkforceSummaryRequest({ year, quarter });
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to load workforce summary')
      );
    }
  }
);

/**
 * fetchEmployeeDossier — Tier 1 employee drawer.
 * Accepts { userId, year, quarter } payload.
 */
export const fetchEmployeeDossier = createAsyncThunk(
  'intelligence/fetchEmployeeDossier',
  async ({ userId, year, quarter }, thunkAPI) => {
    try {
      return await fetchEmployeeDossierRequest({ userId, year, quarter });
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to load employee dossier')
      );
    }
  }
);

/**
 * fetchYearlyAppraisal — Tier 2 yearly strategic view.
 * Accepts { year } payload.
 */
export const fetchYearlyAppraisal = createAsyncThunk(
  'intelligence/fetchYearlyAppraisal',
  async ({ year }, thunkAPI) => {
    try {
      return await fetchYearlyAppraisalRequest(year);
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to load yearly appraisal')
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
    if (emp.ari !== null && emp.ari < 80) {
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
    // Tier 1 — Manager Hub
    workforce:        [],
    selectedDossier:  null,
    isLoading:        false,
    isDossierLoading: false,
    tickerFeed:       [],
    error:            null,

    // Tier 1 — active temporal scope (persisted across drawer opens)
    activeYear:    currentYear,
    activeQuarter: currentQuarter,

    // Tier 2 — Appraisal Engine
    appraisalData:      null,
    isAppraisalLoading: false,
    appraisalYear:      currentYear,
  },
  reducers: {
    clearDossier:  (state) => { state.selectedDossier = null; },
    clearIntelligenceError: (state) => { state.error = null; },
    clearAppraisal: (state) => { state.appraisalData = null; },

    setActiveYear: (state, action) => {
      state.activeYear = action.payload;
    },
    setActiveQuarter: (state, action) => {
      state.activeQuarter = action.payload;
    },
    setAppraisalYear: (state, action) => {
      state.appraisalYear = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      /* ── Tier 1: Workforce summary ─────────────────────────────────── */
      .addCase(fetchWorkforceSummary.pending, (state) => {
        state.isLoading = true;
        state.error     = null;
      })
      .addCase(fetchWorkforceSummary.fulfilled, (state, action) => {
        state.isLoading  = false;
        state.workforce  = action.payload.workforce || [];
        state.tickerFeed = buildTickerFeed(state.workforce);
      })
      .addCase(fetchWorkforceSummary.rejected, (state, action) => {
        state.isLoading = false;
        state.error     = action.payload;
      })

      /* ── Tier 1: Employee dossier ──────────────────────────────────── */
      .addCase(fetchEmployeeDossier.pending, (state) => {
        state.isDossierLoading = true;
        state.error            = null;
      })
      .addCase(fetchEmployeeDossier.fulfilled, (state, action) => {
        state.isDossierLoading = false;
        state.selectedDossier  = action.payload;
      })
      .addCase(fetchEmployeeDossier.rejected, (state, action) => {
        state.isDossierLoading = false;
        state.error            = action.payload;
      })

      /* ── Tier 2: Yearly appraisal ──────────────────────────────────── */
      .addCase(fetchYearlyAppraisal.pending, (state) => {
        state.isAppraisalLoading = true;
        state.error              = null;
      })
      .addCase(fetchYearlyAppraisal.fulfilled, (state, action) => {
        state.isAppraisalLoading = false;
        state.appraisalData      = action.payload;
      })
      .addCase(fetchYearlyAppraisal.rejected, (state, action) => {
        state.isAppraisalLoading = false;
        state.error              = action.payload;
      });
  },
});

export const {
  clearDossier,
  clearIntelligenceError,
  clearAppraisal,
  setActiveYear,
  setActiveQuarter,
  setAppraisalYear,
} = intelligenceSlice.actions;

export default intelligenceSlice.reducer;
