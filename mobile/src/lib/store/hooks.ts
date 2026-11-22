import type { CoreDispatch, RootState } from '@gomecoiffer/client-core';
import { useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = useDispatch.withTypes<CoreDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
