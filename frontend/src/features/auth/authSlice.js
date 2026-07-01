import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  loginRequest,
  fetchMeRequest,
  clearAuthSession,
} from './authService';

const storedToken = localStorage.getItem('token');

const initialState = {
  user: null,
  token: storedToken,
  isAuthenticated: false,
  isLoading: Boolean(storedToken),
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, thunkAPI) => {
    try {
      const response = await loginRequest(credentials);
      if (!response.success) {
        return thunkAPI.rejectWithValue(response.message || 'Login failed');
      }
      return response;
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || 'Login failed';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, thunkAPI) => {
    try {
      const response = await fetchMeRequest();
      if (!response.success) {
        clearAuthSession();
        return thunkAPI.rejectWithValue(response.message || 'Session expired');
      }
      return response;
    } catch (error) {
      clearAuthSession();
      const message =
        error.response?.data?.message ||
        error.message ||
        'Unable to restore session';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const syncUserSession = createAsyncThunk(
  'auth/syncUserSession',
  async (_, thunkAPI) => {
    try {
      const response = await fetchMeRequest();
      if (!response.success) {
        clearAuthSession();
        return thunkAPI.rejectWithValue(response.message || 'Session expired');
      }
      return response;
    } catch (error) {
      clearAuthSession();
      const message =
        error.response?.data?.message ||
        error.message ||
        'Unable to sync session';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  clearAuthSession();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload;
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload;
      })
      .addCase(syncUserSession.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(syncUserSession.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
