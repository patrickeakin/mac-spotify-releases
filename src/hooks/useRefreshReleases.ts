import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFollowedArtists, getUserProfile } from '../services/spotify-client';
import { getNewReleasesFromSpotify } from '../services/spotify-releases';
import { FormattedRelease } from '../services/types';
import { RELEASES_QUERY_KEY } from './useReleases';
import { ARTISTS_QUERY_KEY } from './useFollowedArtists';

export interface RefreshProgress {
  current: number;
  total: number;
  newReleases: number;
}

const ZERO_PROGRESS: RefreshProgress = { current: 0, total: 0, newReleases: 0 };

export function useRefreshReleases() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<RefreshProgress>(ZERO_PROGRESS);

  const mutation = useMutation<FormattedRelease[]>({
    mutationFn: async () => {
      setProgress(ZERO_PROGRESS);
      const profile = await getUserProfile();
      const artists = await fetchFollowedArtists();
      queryClient.setQueryData(ARTISTS_QUERY_KEY, artists);
      if (artists.length === 0) return [];
      return getNewReleasesFromSpotify(profile.country, artists, (current, total, newReleases) => {
        setProgress({ current, total, newReleases });
      });
    },
    onSuccess: releases => {
      queryClient.setQueryData(RELEASES_QUERY_KEY, releases);
    },
  });

  const refresh = useCallback(() => mutation.mutateAsync(), [mutation]);

  return {
    refresh,
    isRefreshing: mutation.isPending,
    progress,
    error: mutation.error,
  };
}
