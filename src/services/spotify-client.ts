import axios from 'axios';
import { SpotifyArtist, UnifiedCacheData } from './types';
import { getCachedData, cacheData, hashArtistList } from './cache-manager';

// Spotify configuration
const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '';
// Use custom protocol for Electron app, fallback to localhost for dev
const REDIRECT_URI = (window as any).electronAPI
  ? 'numu://callback'
  : (process.env.REACT_APP_SPOTIFY_REDIRECT_URI || 'http://localhost:3000');
const SCOPES = 'user-follow-read';

// OAuth functions
export const getAuthUrl = (): string => {
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    show_dialog: 'true'
  });
  
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

export const getAccessTokenFromUrl = (): string | null => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
};

export const getCurrentUser = async (accessToken: string): Promise<string> => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data.id;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.warn('⚠️ OAuth token expired - authentication required');
      throw new Error('AUTH_EXPIRED');
    }
    console.error('Error getting user info:', error);
    return 'unknown';
  }
};

export const getFollowedArtists = async (accessToken: string, forceRefresh: boolean = false): Promise<SpotifyArtist[]> => {
  // Try to use cached data first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = getCachedData();
    if (cached && cached.followedArtists.length > 0) {
      // Check if artists cache is less than 24 hours old
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - cached.artistsFetchedAt < twentyFourHours) {
        console.log(`Using cached artists: ${cached.followedArtists.length} artists from ${new Date(cached.artistsFetchedAt).toLocaleString()}`);
        return cached.followedArtists;
      }
    }
  }
  
  console.log('Fetching fresh followed artists from Spotify...');
  
  // Only get current user ID when we need to fetch fresh data
  const currentUserId = await getCurrentUser(accessToken);
  const artists: SpotifyArtist[] = [];
  let url = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';
  let pageCount = 0;
  
  while (url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const spotifyArtists = response.data.artists.items.map((artist: any) => ({
        id: artist.id,
        name: artist.name
      }));
      
      artists.push(...spotifyArtists);
      url = response.data.artists.next;
      pageCount++;
      
      console.log(`Fetched page ${pageCount}, total artists: ${artists.length}`);
      
      // Conservative delay between pages
      if (url) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 + 2000 : 10000;
        console.warn(`Rate limited while fetching artists page ${pageCount}. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('Error fetching followed artists:', error);
        break;
      }
    }
  }
  
  // Cache the results if we got actual artists
  if (artists.length > 0) {
    // Update cache with new artists data
    const existingCache = getCachedData();
    if (existingCache) {
      existingCache.followedArtists = artists;
      existingCache.artistsFetchedAt = Date.now();
      existingCache.userId = currentUserId;
      cacheData(existingCache);
    } else {
      // Create minimal cache entry with just artists data
      const basicCache: UnifiedCacheData = {
        followedArtists: artists,
        artistsFetchedAt: Date.now(),
        releases: [],
        lastProcessedArtistIndex: 0,
        totalArtists: artists.length,
        isComplete: false,
        timestamp: Date.now(),
        userId: currentUserId,
        artistListHash: hashArtistList(artists)
      };
      cacheData(basicCache);
    }
    console.log(`Cached ${artists.length} followed artists`);
  }
  
  return artists;
};