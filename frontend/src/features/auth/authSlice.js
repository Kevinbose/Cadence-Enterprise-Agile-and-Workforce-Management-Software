import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loginUser, logoutUser } from './authService';

const initialState = {
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  isError: false,
  message: '',
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, thunkAPI) => {
    try {
      return await loginUser(credentials);
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || 'Login failed';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await logoutUser();
  localStorage.removeItem('token');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isError = false;
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('token', action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.user = null;
        state.token = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      });
  },
});

export const { reset } = authSlice.actions;
export default authSlice.reducer;
