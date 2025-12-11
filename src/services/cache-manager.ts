import { UnifiedCacheData, SpotifyArtist } from './types';

// Cache configuration
const CACHE_KEY = 'unified_releases_cache';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Utility functions
export const hashArtistList = (artists: SpotifyArtist[]): string => {
  const sortedIds = artists.map(a => a.id).sort();
  return btoa(sortedIds.join(',')).substring(0, 16);
};

// Cache management functions
export const getCachedData = (): UnifiedCacheData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached) as UnifiedCacheData;
      // Check if cache is less than 30 days old
      if (Date.now() - data.timestamp < THIRTY_DAYS_MS) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Error reading cached data:', error);
    return null;
  }
};

export const cacheData = (data: UnifiedCacheData): void => {
  try {
    const dataString = JSON.stringify(data);
    const estimatedSize = new Blob([dataString]).size;
    console.log(`Attempting to cache ${estimatedSize} bytes of unified data`);
    
    localStorage.setItem(CACHE_KEY, dataString);
    console.log(`Successfully cached unified data: ${data.releases.length} releases, ${data.lastProcessedArtistIndex}/${data.totalArtists} artists processed`);
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Clearing old cache and retrying...');
      localStorage.removeItem(CACHE_KEY);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        console.log('Successfully cached data after clearing old cache');
      } catch (retryError) {
        console.error('Failed to cache data even after clearing old cache:', retryError);
      }
    } else {
      console.error('Error caching data:', error);
    }
  }
};

export const clearUnifiedCache = (): void => {
  localStorage.removeItem(CACHE_KEY);
  console.log('Unified cache cleared');
};

export const getUnifiedCacheInfo = (): UnifiedCacheData | null => {
  return getCachedData();
};