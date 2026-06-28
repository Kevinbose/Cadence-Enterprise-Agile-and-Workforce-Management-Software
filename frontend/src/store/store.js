import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import attendanceReducer from '../features/attendance/attendanceSlice';
import kanbanReducer from '../features/kanban/kanbanSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    attendance: attendanceReducer,
    kanban: kanbanReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
