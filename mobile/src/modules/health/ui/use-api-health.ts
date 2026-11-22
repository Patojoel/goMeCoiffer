import { useGetHealthQuery } from '@gomecoiffer/client-core';

export type ApiHealthView = 'loading' | 'error' | 'ok' | 'databaseDown';

/** Ordre d'écran : erreur d'abord (un refus efface la donnée), puis chargement, puis données. */
export function useApiHealth() {
  const { data, isError, isLoading, isFetching, refetch } = useGetHealthQuery();

  const view: ApiHealthView = isError
    ? 'error'
    : isLoading || !data
      ? 'loading'
      : data.database === 'up'
        ? 'ok'
        : 'databaseDown';

  return { view, isRetrying: isFetching, retry: () => void refetch() };
}
