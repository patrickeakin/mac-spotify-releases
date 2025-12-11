// Export all API modules
export * from './types';
export * from './spotify-client';
export * from './musicbrainz-client';
export * from './release-formatter';
export * from './cache-manager';
export * from './unified-api';
export * from './electron-storage';

// Re-export main functions for backward compatibility
export { getNewReleasesUnified } from './unified-api';
export { getAuthUrl, getAccessTokenFromUrl } from './spotify-client';
export { clearUnifiedCache, getUnifiedCacheInfo } from './cache-manager';
export type { FormattedRelease } from './types';