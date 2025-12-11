import axios from 'axios';
import { MusicBrainzRelease } from './types';

// MusicBrainz configuration
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'SpotifyReleasesApp/1.0 (https://github.com/spotify-releases)';

// Image cache for cover art URLs
const imageCache = new Map<string, string>();

// Utility functions
const normalizeArtistName = (name: string): string => {
  return name
    .replace(/^(The|A|An)\s+/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/[^\w\s\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const searchArtistInMusicBrainz = async (artistName: string): Promise<string | null> => {
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

export const getArtistReleasesFromMusicBrainz = async (
  artistId: string, 
  daysBack: number = 180
): Promise<MusicBrainzRelease[]> => {
  try {
    console.log(`🎵 Fetching releases for artist ID: ${artistId}`);
    const response = await axios.get(`${MUSICBRAINZ_BASE_URL}/release`, {
      params: {
        artist: artistId,
        fmt: 'json',
        limit: 100,
        inc: 'artist-credits+release-groups',
        status: 'official'
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

export const getCoverArtUrl = async (releaseId: string): Promise<string> => {
  if (imageCache.has(releaseId)) {
    const cachedUrl = imageCache.get(releaseId)!;
    console.log(`🖼️ Using cached cover art for ${releaseId}`);
    return cachedUrl;
  }

  try {
    const response = await axios.get(`https://coverartarchive.org/release/${releaseId}`, {
      headers: {
        'User-Agent': USER_AGENT
      },
      maxRedirects: 5,
      timeout: 10000
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
    // Handle specific error cases
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        console.log(`🖼️ No cover art available for ${releaseId} (404)`);
      } else if (error.response?.status === 307 || error.response?.status === 302) {
        console.log(`🖼️ Cover art redirect for ${releaseId}, but data not accessible`);
      } else {
        console.log(`🖼️ Cover art error for ${releaseId}: ${error.response?.status || error.message}`);
      }
    } else {
      console.log(`🖼️ Cover art error for ${releaseId}: ${error}`);
    }
    
    imageCache.set(releaseId, '');
    return '';
  }
};