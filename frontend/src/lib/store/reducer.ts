import { combineReducers } from '@reduxjs/toolkit';
import { sessionSlice } from '@/lib/rbac/sessionSlice';
import { appApi } from './api/appApi';

export const reducer = combineReducers({
  [appApi.reducerPath]: appApi.reducer,
  [sessionSlice.reducerPath]: sessionSlice.reducer,
});

export type RootState = ReturnType<typeof reducer>;
