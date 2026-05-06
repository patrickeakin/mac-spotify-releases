// Export all API modules
export * from './types';
export * from './spotify-client';
export * from './spotify-releases';
export * from './musicbrainz-client';
export * from './release-formatter';
export * from './cache-manager';
export * from './unified-api';
export * from './electron-storage';
export * from './auth-manager';

// Re-export main functions for backward compatibility
export { getNewReleasesUnified } from './unified-api';
export { getAuthUrl, getAccessTokenFromUrl, getAuthorizationCodeFromUrl, exchangeCodeForToken } from './spotify-client';
export { clearUnifiedCache, getUnifiedCacheInfo } from './cache-manager';
export type { FormattedRelease } from './types';