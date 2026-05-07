import { useQuery } from '@tanstack/react-query';
import { SpotifyArtist } from '../services/types';

export const ARTISTS_QUERY_KEY = ['followedArtists'] as const;

export function useFollowedArtists() {
  const query = useQuery<SpotifyArtist[]>({
    queryKey: ARTISTS_QUERY_KEY,
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return { artists: query.data ?? [] };
}
