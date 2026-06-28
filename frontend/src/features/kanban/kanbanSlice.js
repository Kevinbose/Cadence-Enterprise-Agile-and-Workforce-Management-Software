import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchTasks, createTask, updateTaskStatus } from './kanbanService';

const initialState = {
  tasks: [],
  isLoading: false,
  isError: false,
  message: '',
};

export const loadTasks = createAsyncThunk(
  'kanban/loadTasks',
  async (_, thunkAPI) => {
    try {
      return await fetchTasks();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to load tasks';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const addTask = createAsyncThunk(
  'kanban/addTask',
  async (taskData, thunkAPI) => {
    try {
      return await createTask(taskData);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to create task';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const moveTask = createAsyncThunk(
  'kanban/moveTask',
  async ({ taskId, status }, thunkAPI) => {
    try {
      return await updateTaskStatus({ taskId, status });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to update task status';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const kanbanSlice = createSlice({
  name: 'kanban',
  initialState,
  reducers: {
    resetKanban: (state) => {
      state.isLoading = false;
      state.isError = false;
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadTasks.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload;
      })
      .addCase(loadTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(addTask.fulfilled, (state, action) => {
        state.tasks.push(action.payload);
      })
      .addCase(moveTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
      });
  },
});

export const { resetKanban } = kanbanSlice.actions;
export default kanbanSlice.reducer;
