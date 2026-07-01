import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import {
  getBoardRequest,
  createIssueRequest,
  updateTaskStatusRequest,
  rejectTaskRequest,
  getEligibleAssigneesRequest,
  editIssueRequest,
  deleteIssueRequest,
  bulkAdjudicateRequest,
} from './kanbanService';

const initialState = {
  boardData: [], // Nested swimlane hierarchy from the API
  flatTasks: [], // Denormalized list used for column rendering
  sprint: null,
  isTemporalScrumMaster: false,
  onlyMyIssues: false,
  eligibleAssignees: [], // Populated by GET /users/assignees
  isLoading: false,
  isSubmitting: false,
  isLoadingAssignees: false,
  error: null,
  lastComment: null,
  snapshots: {}, // taskId -> previous status, for optimistic revert
};

const extractError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

export const fetchBoard = createAsyncThunk(
  'kanban/fetchBoard',
  async (sprintId, thunkAPI) => {
    try {
      return await getBoardRequest(sprintId || null);
    } catch (error) {
      return thunkAPI.rejectWithValue(extractError(error, 'Failed to load board'));
    }
  }
);

export const createIssue = createAsyncThunk(
  'kanban/createIssue',
  async (payload, thunkAPI) => {
    try {
      const data = await createIssueRequest(payload);
      // Re-fetch the same sprint board that triggered the creation so the
      // nested swimlane hierarchy is accurate and no tasks go missing.
      thunkAPI.dispatch(fetchBoard(payload.sprintId || null));
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to create issue')
      );
    }
  }
);

export const updateStatus = createAsyncThunk(
  'kanban/updateStatus',
  async ({ taskId, status }, thunkAPI) => {
    try {
      return await updateTaskStatusRequest({ taskId, status });
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to update task status')
      );
    }
  }
);

export const rejectTask = createAsyncThunk(
  'kanban/rejectTask',
  async ({ taskId, rejectionReason }, thunkAPI) => {
    try {
      return await rejectTaskRequest({ taskId, rejectionReason });
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to reject task')
      );
    }
  }
);

export const editIssue = createAsyncThunk(
  'kanban/editIssue',
  async ({ id, data }, thunkAPI) => {
    try {
      const result = await editIssueRequest(id, data);
      // Type or parent changes can regroup swimlanes — refresh the board.
      if (data.type !== undefined || data.parentId !== undefined) {
        const sprintId = thunkAPI.getState().kanban.sprint?.id || null;
        thunkAPI.dispatch(fetchBoard(sprintId));
      }
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to update issue')
      );
    }
  }
);

export const deleteIssue = createAsyncThunk(
  'kanban/deleteIssue',
  async (id, thunkAPI) => {
    try {
      return await deleteIssueRequest(id);
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to delete issue')
      );
    }
  }
);

export const bulkAdjudicate = createAsyncThunk(
  'kanban/bulkAdjudicate',
  async ({ taskIds, action, comment }, thunkAPI) => {
    try {
      const data = await bulkAdjudicateRequest({ taskIds, action, comment });
      // A bulk cascade can promote several parents/grandparents to DONE at
      // once — reshuffling swimlanes in ways that are unsafe to guess at on
      // the client. Always re-fetch the full board; the DB is the single
      // source of truth for the post-cascade hierarchy.
      const sprintId = thunkAPI.getState().kanban.sprint?.id || null;
      thunkAPI.dispatch(fetchBoard(sprintId));
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Bulk adjudication failed')
      );
    }
  }
);

export const fetchEligibleAssignees = createAsyncThunk(
  'kanban/fetchEligibleAssignees',
  async (_, thunkAPI) => {
    try {
      return await getEligibleAssigneesRequest();
    } catch (error) {
      return thunkAPI.rejectWithValue(
        extractError(error, 'Failed to load eligible assignees')
      );
    }
  }
);

const replaceTask = (state, task) => {
  const index = state.flatTasks.findIndex((t) => t.id === task.id);
  if (index !== -1) {
    state.flatTasks[index] = { ...state.flatTasks[index], ...task };
  } else {
    state.flatTasks.push(task);
  }
};

const kanbanSlice = createSlice({
  name: 'kanban',
  initialState,
  reducers: {
    toggleMyIssues: (state) => {
      state.onlyMyIssues = !state.onlyMyIssues;
    },
    clearKanbanError: (state) => {
      state.error = null;
    },
    resetKanban: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ── fetchBoard ──────────────────────────────────────────────
      .addCase(fetchBoard.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBoard.fulfilled, (state, action) => {
        state.isLoading = false;
        state.boardData = action.payload.board || [];
        state.flatTasks = action.payload.tasks || [];
        state.sprint = action.payload.sprint || null;
        state.isTemporalScrumMaster =
          action.payload.isTemporalScrumMaster === true;
      })
      .addCase(fetchBoard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ── createIssue ─────────────────────────────────────────────
      .addCase(createIssue.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(createIssue.fulfilled, (state, action) => {
        state.isSubmitting = false;
        if (action.payload.task) replaceTask(state, action.payload.task);
      })
      .addCase(createIssue.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      // ── updateStatus (optimistic) ───────────────────────────────
      .addCase(updateStatus.pending, (state, action) => {
        const { taskId, status } = action.meta.arg;
        const task = state.flatTasks.find((t) => t.id === taskId);
        if (task) {
          state.snapshots[taskId] = task.status;
          task.status = status;
        }
      })
      .addCase(updateStatus.fulfilled, (state, action) => {
        delete state.snapshots[action.payload.task.id];
        replaceTask(state, action.payload.task);
        // Reflect cascade auto-rollup results immediately.
        (action.payload.cascadedParents || []).forEach((parentId) => {
          const parent = state.flatTasks.find((t) => t.id === parentId);
          if (parent) parent.status = 'DONE';
        });
      })
      .addCase(updateStatus.rejected, (state, action) => {
        const { taskId } = action.meta.arg;
        const prev = state.snapshots[taskId];
        if (prev !== undefined) {
          const task = state.flatTasks.find((t) => t.id === taskId);
          if (task) task.status = prev;
          delete state.snapshots[taskId];
        }
        state.error = action.payload;
        toast.error(action.payload || 'Failed to move task.');
      })

      // ── rejectTask ──────────────────────────────────────────────
      .addCase(rejectTask.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(rejectTask.fulfilled, (state, action) => {
        state.isSubmitting = false;
        replaceTask(state, action.payload.task);
        state.lastComment = action.payload.comment || null;
      })
      .addCase(rejectTask.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
        toast.error(action.payload || 'Failed to reject task.');
      })

      // ── editIssue ───────────────────────────────────────────────
      .addCase(editIssue.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(editIssue.fulfilled, (state, action) => {
        state.isSubmitting = false;
        if (action.payload.task) replaceTask(state, action.payload.task);
      })
      .addCase(editIssue.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      // ── deleteIssue ─────────────────────────────────────────────
      .addCase(deleteIssue.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(deleteIssue.fulfilled, (state, action) => {
        state.isSubmitting = false;
        const deletedIds = action.payload.deletedIds || [];
        const deletedSet = new Set(deletedIds);
        // Instantly purge the entire deleted hierarchy from the local flat list.
        state.flatTasks = state.flatTasks.filter((t) => !deletedSet.has(t.id));
      })
      .addCase(deleteIssue.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      // ── bulkAdjudicate ──────────────────────────────────────────
      .addCase(bulkAdjudicate.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(bulkAdjudicate.fulfilled, (state) => {
        state.isSubmitting = false;
        // flatTasks/boardData refresh via the fetchBoard dispatch inside the thunk.
      })
      .addCase(bulkAdjudicate.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
        toast.error(action.payload || 'Bulk adjudication failed.');
      })

      // ── fetchEligibleAssignees ──────────────────────────────────
      .addCase(fetchEligibleAssignees.pending, (state) => {
        state.isLoadingAssignees = true;
      })
      .addCase(fetchEligibleAssignees.fulfilled, (state, action) => {
        state.isLoadingAssignees = false;
        state.eligibleAssignees = action.payload.assignees || [];
      })
      .addCase(fetchEligibleAssignees.rejected, (state) => {
        state.isLoadingAssignees = false;
        // Non-fatal — the modal will degrade gracefully.
      });
  },
});

export const { toggleMyIssues, clearKanbanError, resetKanban } =
  kanbanSlice.actions;
export default kanbanSlice.reducer;
