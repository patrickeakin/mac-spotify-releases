import { FormattedRelease, UnifiedCacheData } from './types';
import { getUserProfile, getFollowedArtists } from './spotify-client';
import { getNewReleasesFromSpotify } from './spotify-releases';
import { getCachedData, cacheData, hashArtistList } from './cache-manager';

export const getNewReleasesUnified = async (
  accessToken: string,
  onProgress?: (current: number, total: number, newReleases: number) => void
): Promise<FormattedRelease[]> => {
  // Slice 0: serve cached data immediately when available; only fetch on explicit refresh.
  const cachedData = await getCachedData();
  if (cachedData && cachedData.isComplete) {
    console.log(`Using cached releases: ${cachedData.releases.length} from ${new Date(cachedData.timestamp).toLocaleString()}`);
    if (onProgress) {
      onProgress(cachedData.totalArtists, cachedData.totalArtists, cachedData.releases.length);
    }
    return cachedData.releases;
  }

  const profile = await getUserProfile(accessToken);
  const followedArtists = await getFollowedArtists(accessToken);
  if (followedArtists.length === 0) {
    console.error('No followed artists found');
    return [];
  }

  console.log(`Fetching releases from Spotify for ${followedArtists.length} artists (market=${profile.country})`);

  const releases = await getNewReleasesFromSpotify(
    accessToken,
    profile.country,
    followedArtists,
    onProgress
  );

  const cacheEntry: UnifiedCacheData = {
    followedArtists,
    artistsFetchedAt: Date.now(),
    releases,
    lastProcessedArtistIndex: followedArtists.length,
    totalArtists: followedArtists.length,
    isComplete: true,
    timestamp: Date.now(),
    userId: profile.id,
    artistListHash: hashArtistList(followedArtists)
  };
  await cacheData(cacheEntry);

  console.log(`Spotify scan complete: ${releases.length} releases from ${followedArtists.length} artists`);
  return releases;
};
