import { FormattedRelease, UnifiedCacheData } from './types';
import { getCurrentUser, getFollowedArtists } from './spotify-client';
import { searchArtistInMusicBrainz, getArtistReleasesFromMusicBrainz } from './musicbrainz-client';
import { formatMusicBrainzRelease, groupAndDeduplicateReleases } from './release-formatter';
import { getCachedData, cacheData, hashArtistList } from './cache-manager';

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