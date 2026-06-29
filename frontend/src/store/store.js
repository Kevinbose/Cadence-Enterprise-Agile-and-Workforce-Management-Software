import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import attendanceReducer from '../features/attendance/attendanceSlice';
import kanbanReducer from '../features/kanban/kanbanSlice';
import scrumReducer from '../features/scrum/scrumSlice';
import sprintReducer from '../features/sprints/sprintSlice';
import auditReducer from '../features/audits/auditSlice';
import intelligenceReducer from '../features/intelligence/intelligenceSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    attendance: attendanceReducer,
    kanban: kanbanReducer,
    scrum: scrumReducer,
    sprint: sprintReducer,
    audit: auditReducer,
    intelligence: intelligenceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
