import { createAsyncThunk } from '@reduxjs/toolkit';
import type { ApiFailure } from '../http/HttpError.js';
import type { AppDependencies } from './dependencies/AppDependencies.js';
import type { RootState } from './reducer.js';
import type { CoreDispatch } from './store.js';

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: CoreDispatch;
  extra: AppDependencies;
  rejectValue: ApiFailure;
}>();
