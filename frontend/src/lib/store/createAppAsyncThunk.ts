import { createAsyncThunk } from '@reduxjs/toolkit';
import type { QueryError } from './api/appApi';
import type { AppDependencies } from './dependencies/AppDependencies';
import type { RootState } from './reducer';
import type { AppDispatch } from './store';

/** Thunk de commande : gateways via `extra`, erreur sérialisable via `rejectWithValue`. */
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  extra: AppDependencies;
  rejectValue: QueryError;
}>();
