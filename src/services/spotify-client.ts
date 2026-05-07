import axios, { AxiosRequestConfig } from 'axios';
import { SpotifyArtist, SpotifyAlbum, SpotifyTokens, SpotifyUserProfile, UnifiedCacheData } from './types';
import { getCachedData, cacheData } from './cache-manager';
import { authManager } from './auth-manager';

// Spotify configuration
const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '';
// Use custom protocol for Electron, localhost for browser
const REDIRECT_URI = (window as any).electronAPI
  ? 'numu://callback'
  : (process.env.REACT_APP_SPOTIFY_REDIRECT_URI || 'http://localhost:3000');
const SCOPES = 'user-follow-read';

// PKCE utilities
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hashed = await sha256(codeVerifier);
  return base64urlencode(hashed);
}

// OAuth functions
export const getAuthUrl = async (): Promise<string> => {
  console.log('🔧 OAuth Configuration:');
  console.log('   CLIENT_ID:', CLIENT_ID ? CLIENT_ID.substring(0, 8) + '...' : 'NOT SET');
  console.log('   REDIRECT_URI:', REDIRECT_URI);
  console.log('   Is Electron:', !!(window as any).electronAPI);

  // Generate PKCE parameters
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store code verifier for later use
  localStorage.setItem('pkce_code_verifier', codeVerifier);
  console.log('🔐 Generated PKCE code verifier and challenge');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true'
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  console.log('🔗 Generated auth URL with PKCE:', authUrl);

  return authUrl;
};

export const getAuthorizationCodeFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
};

export const getAccessTokenFromUrl = (): string | null => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
};

export const exchangeCodeForToken = async (code: string): Promise<SpotifyTokens> => {
  const codeVerifier = localStorage.getItem('pkce_code_verifier');

  if (!codeVerifier) {
    throw new Error('No code verifier found');
  }

  console.log('🔄 Exchanging authorization code for access token...');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier
  });

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    localStorage.removeItem('pkce_code_verifier');

    console.log('✅ Successfully exchanged code for token');
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error: any) {
    console.error('❌ Error exchanging code for token:', error.response?.data || error);
    throw error;
  }
};

export const refreshAccessToken = async (refreshToken: string): Promise<SpotifyTokens> => {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID
  });

  const response = await axios.post('https://accounts.spotify.com/api/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return {
    accessToken: response.data.access_token,
    // Spotify rotates refresh tokens; keep the old one if a new one isn't returned.
    refreshToken: response.data.refresh_token || refreshToken,
    expiresIn: response.data.expires_in
  };
};

// Calls the Spotify Web API with an access token from authManager. On a 401 we
// refresh once and retry; on a second 401 we surface AUTH_EXPIRED so the UI
// can prompt re-auth.
async function spotifyRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const attempt = async (token: string): Promise<T> => {
    const response = await axios({
      ...config,
      headers: {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });
    return response.data as T;
  };

  let token = await authManager.getAccessToken();
  try {
    return await attempt(token);
  } catch (error: any) {
    if (error.response?.status !== 401) {
      throw error;
    }
    try {
      token = await authManager.refresh();
    } catch {
      throw new Error('AUTH_EXPIRED');
    }
    try {
      return await attempt(token);
    } catch (retryError: any) {
      if (retryError.response?.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      throw retryError;
    }
  }
}

export const getUserProfile = async (): Promise<SpotifyUserProfile> => {
  const data = await spotifyRequest<{ id: string; country?: string }>({
    method: 'GET',
    url: 'https://api.spotify.com/v1/me'
  });
  return {
    id: data.id,
    country: data.country || 'US'
  };
};

export const getCurrentUser = async (): Promise<string> => {
  try {
    const profile = await getUserProfile();
    return profile.id;
  } catch (error: any) {
    if (error.message === 'AUTH_EXPIRED') {
      throw error;
    }
    console.error('Error getting user info:', error);
    return 'unknown';
  }
};

export const getArtistAlbums = async (
  artistId: string,
  market: string
): Promise<SpotifyAlbum[]> => {
  const albums: SpotifyAlbum[] = [];
  let url: string | null =
    `https://api.spotify.com/v1/artists/${artistId}/albums` +
    `?include_groups=album,single,compilation&limit=50&market=${market}`;

  while (url) {
    try {
      const page: { items: SpotifyAlbum[]; next: string | null } = await spotifyRequest({
        method: 'GET',
        url
      });
      albums.push(...page.items);
      url = page.next;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitMs = (retryAfter ? parseInt(retryAfter, 10) : 1) * 1000 + 500;
        console.warn(`Spotify rate-limited on artist ${artistId}, waiting ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      if (error.message === 'AUTH_EXPIRED') {
        throw error;
      }
      console.error(`Error fetching albums for artist ${artistId}:`, error.response?.status || error.message);
      return albums;
    }
  }

  return albums;
};

export const getFollowedArtists = async (forceRefresh: boolean = false): Promise<SpotifyArtist[]> => {
  if (!forceRefresh) {
    const cached = await getCachedData();
    if (cached && cached.followedArtists.length > 0) {
      console.log(`Using cached artists: ${cached.followedArtists.length} artists from ${new Date(cached.artistsFetchedAt).toLocaleString()}`);
      return cached.followedArtists;
    }
  }

  console.log('Fetching fresh followed artists from Spotify...');

  const currentUserId = await getCurrentUser();
  const artists: SpotifyArtist[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';
  let pageCount = 0;

  while (url) {
    try {
      const page: { artists: { items: any[]; next: string | null } } = await spotifyRequest({
        method: 'GET',
        url
      });

      const spotifyArtists = page.artists.items.map((artist: any) => ({
        id: artist.id,
        name: artist.name
      }));

      artists.push(...spotifyArtists);
      url = page.artists.next;
      pageCount++;

      console.log(`Fetched page ${pageCount}, total artists: ${artists.length}`);

      if (url) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 + 2000 : 10000;
        console.warn(`Rate limited while fetching artists page ${pageCount}. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else if (error.message === 'AUTH_EXPIRED') {
        throw error;
      } else {
        console.error('Error fetching followed artists:', error);
        break;
      }
    }
  }
  
  if (artists.length > 0) {
    const existingCache = await getCachedData();
    if (existingCache) {
      existingCache.followedArtists = artists;
      existingCache.artistsFetchedAt = Date.now();
      existingCache.userId = currentUserId;
      await cacheData(existingCache);
    } else {
      const basicCache: UnifiedCacheData = {
        followedArtists: artists,
        artistsFetchedAt: Date.now(),
        releases: [],
        lastProcessedArtistIndex: 0,
        totalArtists: artists.length,
        isComplete: false,
        timestamp: Date.now(),
        userId: currentUserId
      };
      await cacheData(basicCache);
    }
    console.log(`Cached ${artists.length} followed artists`);
  }
  
  return artists;
};