import axios from 'axios';

// Unified API that combines Spotify (for followed artists) and MusicBrainz (for releases)
const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = process.env.REACT_APP_SPOTIFY_REDIRECT_URI || 'http://localhost:3001';
const SCOPES = 'user-follow-read';

// MusicBrainz configuration
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'SpotifyReleasesApp/1.0 (https://github.com/spotify-releases)';

// Types
interface SpotifyArtist {
  id: string;
  name: string;
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  date: string;
  'artist-credit': Array<{
    name: string;
    artist: {
      id: string;
      name: string;
    };
  }>;
  'cover-art-archive': {
    artwork: boolean;
    count: number;
    front: boolean;
    back: boolean;
  };
  'release-group': {
    id: string;
    'primary-type': string;
  };
}

export interface FormattedRelease {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  image: string;
  releaseDate: string;
  type: string;
  spotifyUrl: string;
  source: string;
}

interface UnifiedCacheData {
  // Spotify data
  followedArtists: SpotifyArtist[];
  artistsFetchedAt: number;
  
  // MusicBrainz processing state
  releases: FormattedRelease[];
  lastProcessedArtistIndex: number;
  totalArtists: number;
  isComplete: boolean;
  
  // Cache metadata
  timestamp: number;
  userId: string;
  artistListHash: string;
}

// OAuth functions (from spotify.ts)
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

// Utility functions
const hashArtistList = (artists: SpotifyArtist[]): string => {
  const sortedIds = artists.map(a => a.id).sort();
  return btoa(sortedIds.join(',')).substring(0, 16);
};

const getCurrentUser = async (accessToken: string): Promise<string> => {
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

// Cache management
const getCachedData = (): UnifiedCacheData | null => {
  try {
    const cached = localStorage.getItem('unified_releases_cache');
    if (cached) {
      const data = JSON.parse(cached) as UnifiedCacheData;
      // Check if cache is less than 30 days old
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - data.timestamp < thirtyDays) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Error reading cached data:', error);
    return null;
  }
};

const cacheData = (data: UnifiedCacheData) => {
  try {
    const dataString = JSON.stringify(data);
    const estimatedSize = new Blob([dataString]).size;
    console.log(`Attempting to cache ${estimatedSize} bytes of unified data`);
    
    localStorage.setItem('unified_releases_cache', dataString);
    console.log(`Successfully cached unified data: ${data.releases.length} releases, ${data.lastProcessedArtistIndex}/${data.totalArtists} artists processed`);
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Clearing old cache and retrying...');
      localStorage.removeItem('unified_releases_cache');
      try {
        localStorage.setItem('unified_releases_cache', JSON.stringify(data));
        console.log('Successfully cached data after clearing old cache');
      } catch (retryError) {
        console.error('Failed to cache data even after clearing old cache:', retryError);
      }
    } else {
      console.error('Error caching data:', error);
    }
  }
};

// Spotify API functions
const getFollowedArtists = async (accessToken: string, forceRefresh: boolean = false): Promise<SpotifyArtist[]> => {
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

// MusicBrainz API functions
const normalizeArtistName = (name: string): string => {
  return name
    .replace(/^(The|A|An)\s+/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/[^\w\s\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const searchArtistInMusicBrainz = async (artistName: string): Promise<string | null> => {
  try {
    console.log(`🔍 Searching MusicBrainz for: "${artistName}"`);
    let response = await axios.get(`${MUSICBRAINZ_BASE_URL}/artist`, {
      params: {
        query: `artist:"${artistName}"`,
        fmt: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (response.data.artists && response.data.artists.length > 0) {
      console.log(`✅ Found exact match for "${artistName}"`);
      return response.data.artists[0].id;
    }

    // Try normalized name
    const normalizedName = normalizeArtistName(artistName);
    if (normalizedName !== artistName) {
      console.log(`🔍 Trying normalized name: "${normalizedName}"`);
      response = await axios.get(`${MUSICBRAINZ_BASE_URL}/artist`, {
        params: {
          query: `artist:"${normalizedName}"`,
          fmt: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': USER_AGENT
        }
      });

      if (response.data.artists && response.data.artists.length > 0) {
        console.log(`✅ Found normalized match for "${artistName}" → "${normalizedName}"`);
        return response.data.artists[0].id;
      }
    }

    console.log(`❌ No match found for "${artistName}"`);
    return null;
  } catch (error) {
    console.error(`Error searching for artist ${artistName} in MusicBrainz:`, error);
    return null;
  }
};

const getArtistReleasesFromMusicBrainz = async (
  artistId: string, 
  daysBack: number = 180
): Promise<MusicBrainzRelease[]> => {
  try {
    console.log(`🎵 Fetching releases for artist ID: ${artistId}`);
    const response = await axios.get(`${MUSICBRAINZ_BASE_URL}/release`, {
      params: {
        query: `arid:${artistId}`,
        fmt: 'json',
        limit: 100
      },
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.data.releases) {
      return [];
    }

    // Filter for recent releases
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    console.log(`📅 Filtering releases since ${cutoffDate.toISOString().split('T')[0]} (${daysBack} days back)`);

    const recentReleases = response.data.releases.filter((release: MusicBrainzRelease) => {
      if (!release.date) {
        return false;
      }
      const releaseDate = new Date(release.date);
      return releaseDate >= cutoffDate;
    });
    
    console.log(`🎵 Found ${recentReleases.length} recent releases for artist ${artistId}`);
    return recentReleases;
  } catch (error) {
    console.error(`Error fetching releases for artist ${artistId}:`, error);
    return [];
  }
};

// Image cache for cover art URLs
const imageCache = new Map<string, string>();

const getCoverArtUrl = async (releaseId: string): Promise<string> => {
  if (imageCache.has(releaseId)) {
    const cachedUrl = imageCache.get(releaseId)!;
    console.log(`🖼️ Using cached cover art for ${releaseId}`);
    return cachedUrl;
  }

  try {
    const response = await axios.get(`https://coverartarchive.org/release/${releaseId}`, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (response.data.images && response.data.images.length > 0) {
      const frontCover = response.data.images.find((img: any) => img.front);
      let imageUrl = '';
      
      if (frontCover) {
        imageUrl = frontCover.thumbnails?.small || frontCover.thumbnails?.large || frontCover.image;
      } else {
        const firstImage = response.data.images[0];
        imageUrl = firstImage.thumbnails?.small || firstImage.thumbnails?.large || firstImage.image;
      }
      
      imageCache.set(releaseId, imageUrl);
      console.log(`🖼️ Cached cover art for ${releaseId}: ${imageUrl.includes('thumbnail') ? 'thumbnail' : 'full-size'}`);
      return imageUrl;
    }
    
    imageCache.set(releaseId, '');
    return '';
  } catch (error) {
    imageCache.set(releaseId, '');
    console.log(`🖼️ No cover art available for ${releaseId}`);
    return '';
  }
};

const formatMusicBrainzRelease = async (release: MusicBrainzRelease): Promise<FormattedRelease> => {
  const coverArt = await getCoverArtUrl(release.id);
  
  const artistName = release['artist-credit'][0]?.name || 'Unknown Artist';
  const albumName = release.title;
  
  // Create Spotify search URL for this release
  const searchQuery = encodeURIComponent(`${artistName} ${albumName}`);
  const spotifySearchUrl = `https://open.spotify.com/search/${searchQuery}`;
  
  return {
    id: release.id,
    name: release.title,
    artist: artistName,
    artistId: release['artist-credit'][0]?.artist?.id || '',
    image: coverArt,
    releaseDate: release.date,
    type: release['release-group']?.['primary-type']?.toLowerCase() || 'album',
    spotifyUrl: spotifySearchUrl,
    source: 'musicbrainz'
  };
};

// Grouping and deduplication logic
const normalizeForGrouping = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")  // Normalize different apostrophes
    .replace(/[""]/g, '"')  // Normalize different quotes
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
};

const groupAndDeduplicateReleases = (releases: FormattedRelease[]): FormattedRelease[] => {
  console.log(`🔍 Before deduplication: ${releases.length} releases`);
  
  // Remove duplicates based on release ID
  const uniqueReleases = releases.filter((release, index, array) => 
    array.findIndex(r => r.id === release.id) === index
  );
  console.log(`🔍 After ID deduplication: ${uniqueReleases.length} releases`);
  
  // Group by album name and artist to remove duplicate album releases
  const albumGroups = new Map<string, FormattedRelease>();
  uniqueReleases.forEach(release => {
    const normalizedArtist = normalizeForGrouping(release.artist);
    const normalizedName = normalizeForGrouping(release.name);
    const albumKey = `${normalizedArtist}::${normalizedName}`;
    
    if (!albumGroups.has(albumKey)) {
      albumGroups.set(albumKey, release);
    } else {
      console.log(`🔄 Grouping duplicate: "${release.name}" by ${release.artist} (${release.releaseDate})`);
    }
  });
  
  const groupedReleases = Array.from(albumGroups.values());
  console.log(`🔍 After album grouping: ${groupedReleases.length} releases`);
  
  if (uniqueReleases.length !== groupedReleases.length) {
    console.log(`⚠️ Grouped ${uniqueReleases.length - groupedReleases.length} duplicate albums`);
  }
  
  return groupedReleases;
};

// Main unified function
export const getNewReleasesUnified = async (
  accessToken: string,
  onProgress?: (current: number, total: number, newReleases: number) => void
): Promise<FormattedRelease[]> => {
  // Check cache first - if we have complete cached data, use it immediately
  const cachedData = getCachedData();
  if (cachedData && cachedData.isComplete) {
    console.log(`Using complete cached releases: ${cachedData.releases.length} releases from ${new Date(cachedData.timestamp).toLocaleString()}`);
    if (onProgress) {
      onProgress(cachedData.totalArtists, cachedData.totalArtists, cachedData.releases.length);
    }
    return cachedData.releases;
  }
  
  // Only get user ID and artists if we need to fetch fresh data
  const currentUserId = await getCurrentUser(accessToken);
  
  // Get followed artists from Spotify
  const followedArtists = await getFollowedArtists(accessToken);
  if (followedArtists.length === 0) {
    console.error('No followed artists found');
    return [];
  }
  
  const artistListHash = hashArtistList(followedArtists);
  
  // Check if we have incomplete cache that matches current artist list
  if (cachedData && 
      cachedData.userId === currentUserId && 
      cachedData.artistListHash === artistListHash && 
      !cachedData.isComplete) {
    console.log(`Found incomplete cache, resuming from artist ${cachedData.lastProcessedArtistIndex + 1}/${followedArtists.length}`);
  }
  
  // Determine starting point
  let startIndex = 0;
  let existingReleases: FormattedRelease[] = [];
  
  if (cachedData && 
      cachedData.userId === currentUserId && 
      cachedData.artistListHash === artistListHash && 
      !cachedData.isComplete) {
    startIndex = cachedData.lastProcessedArtistIndex;
    existingReleases = cachedData.releases;
    console.log(`Resuming from incomplete cache: starting at artist ${startIndex + 1}/${followedArtists.length}, already have ${existingReleases.length} releases`);
  }
  
  console.log('Fetching releases from MusicBrainz...');
  
  const newReleases: FormattedRelease[] = [];
  let currentDelay = 1100; // MusicBrainz rate limit: 1 req/sec
  let processedCount = 0;
  
  for (let i = startIndex; i < followedArtists.length; i++) {
    const spotifyArtist = followedArtists[i];
    
    try {
      console.log(`Processing artist ${i + 1}/${followedArtists.length}: ${spotifyArtist.name}`);
      
      // Search for artist in MusicBrainz
      const musicBrainzArtistId = await searchArtistInMusicBrainz(spotifyArtist.name);
      
      if (musicBrainzArtistId) {
        // Wait for rate limit
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        // Get recent releases
        const artistReleases = await getArtistReleasesFromMusicBrainz(musicBrainzArtistId);
        
        // Format releases
        for (const release of artistReleases) {
          try {
            const formattedRelease = await formatMusicBrainzRelease(release);
            newReleases.push(formattedRelease);
          } catch (error) {
            console.error('Error formatting release:', error);
          }
          
          // Small delay for cover art requests
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      processedCount++;
      
      // Report progress
      const allCurrentReleases = [...existingReleases, ...newReleases];
      if (onProgress) {
        onProgress(i + 1, followedArtists.length, allCurrentReleases.length);
      }
      
      // Cache progress every 10 artists
      if (processedCount % 10 === 0) {
        const tempGroupedReleases = groupAndDeduplicateReleases(allCurrentReleases);
        const tempCacheData: UnifiedCacheData = {
          followedArtists,
          artistsFetchedAt: Date.now(),
          releases: tempGroupedReleases,
          lastProcessedArtistIndex: i + 1,
          totalArtists: followedArtists.length,
          isComplete: false,
          timestamp: Date.now(),
          userId: currentUserId,
          artistListHash
        };
        cacheData(tempCacheData);
      }
      
    } catch (error: any) {
      if (error.response?.status === 503) {
        // Rate limited - increase delay
        currentDelay = Math.min(currentDelay * 1.5, 5000);
        console.warn(`MusicBrainz rate limited, increasing delay to ${currentDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        i--; // Retry same artist
        continue;
      } else {
        console.error(`Error processing artist ${spotifyArtist.name}:`, error);
      }
    }
  }
  
  // Combine and deduplicate all releases
  const allReleases = [...existingReleases, ...newReleases];
  const finalReleases = groupAndDeduplicateReleases(allReleases);
  
  // Cache final complete result
  const finalCacheData: UnifiedCacheData = {
    followedArtists,
    artistsFetchedAt: Date.now(),
    releases: finalReleases,
    lastProcessedArtistIndex: followedArtists.length,
    totalArtists: followedArtists.length,
    isComplete: true,
    timestamp: Date.now(),
    userId: currentUserId,
    artistListHash
  };
  cacheData(finalCacheData);
  
  console.log(`Processing complete: ${finalReleases.length} unique releases from ${followedArtists.length} artists`);
  return finalReleases;
};

// Utility functions for cache management
export const clearUnifiedCache = () => {
  localStorage.removeItem('unified_releases_cache');
  console.log('Unified cache cleared');
};

export const getUnifiedCacheInfo = (): UnifiedCacheData | null => {
  return getCachedData();
};