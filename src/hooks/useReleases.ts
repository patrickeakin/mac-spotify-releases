import { useQuery } from '@tanstack/react-query';
import { FormattedRelease } from '../services/types';

export const RELEASES_QUERY_KEY = ['releases'] as const;

export function useReleases() {
  const query = useQuery<FormattedRelease[]>({
    queryKey: RELEASES_QUERY_KEY,
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return {
    releases: query.data ?? [],
    lastUpdated: query.dataUpdatedAt || null,
  };
}
