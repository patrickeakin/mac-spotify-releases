import { UnifiedCacheData, SpotifyArtist } from './types';
import { storage } from './electron-storage';

const CACHE_KEY = 'unified_releases_cache';

export const hashArtistList = (artists: SpotifyArtist[]): string => {
  const sortedIds = artists.map(a => a.id).sort();
  return btoa(sortedIds.join(',')).substring(0, 16);
};

export const getCachedData = async (): Promise<UnifiedCacheData | null> => {
  try {
    const data = await storage.get(CACHE_KEY);
    return (data as UnifiedCacheData) ?? null;
  } catch (error) {
    console.error('Error reading cached data:', error);
    return null;
  }
};

export const cacheData = async (data: UnifiedCacheData): Promise<void> => {
  try {
    await storage.set(CACHE_KEY, data);
    console.log(`Cached ${data.releases.length} releases (${data.lastProcessedArtistIndex}/${data.totalArtists} artists processed)`);
  } catch (error) {
    console.error('Error caching data:', error);
  }
};

export const clearUnifiedCache = async (): Promise<void> => {
  await storage.delete(CACHE_KEY);
  console.log('Unified cache cleared');
};

export const getUnifiedCacheInfo = async (): Promise<UnifiedCacheData | null> => {
  return getCachedData();
};
