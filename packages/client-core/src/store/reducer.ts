import { combineReducers } from '@reduxjs/toolkit';
import { sessionSlice } from '../rbac/sessionSlice.js';
import { appApi } from './api/appApi.js';

export const reducer = combineReducers({
  [appApi.reducerPath]: appApi.reducer,
  [sessionSlice.reducerPath]: sessionSlice.reducer,
});

export type RootState = ReturnType<typeof reducer>;
