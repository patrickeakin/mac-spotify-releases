import { MusicBrainzRelease, FormattedRelease } from './types';
import { getCoverArtUrl } from './musicbrainz-client';

// Grouping and deduplication logic
const normalizeForGrouping = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")  // Normalize different apostrophes
    .replace(/[""]/g, '"')  // Normalize different quotes
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
};

export const formatMusicBrainzRelease = async (release: MusicBrainzRelease): Promise<FormattedRelease> => {
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

export const groupAndDeduplicateReleases = (releases: FormattedRelease[]): FormattedRelease[] => {
  console.log(`🔍 Before deduplication: ${releases.length} releases`);
  
  // Remove duplicates based on release ID
  const uniqueReleases = releases.filter((release, index, array) => 
    array.findIndex(r => r.id === release.id) === index
  );
  console.log(`🔍 After ID deduplication: ${uniqueReleases.length} releases`);
  
  // Group by album name and artist with smart prioritization
  const albumGroups = new Map<string, FormattedRelease>();
  uniqueReleases.forEach(release => {
    const normalizedArtist = normalizeForGrouping(release.artist);
    const normalizedName = normalizeForGrouping(release.name);
    const albumKey = `${normalizedArtist}::${normalizedName}`;
    
    if (!albumGroups.has(albumKey)) {
      // First release for this album - keep it
      albumGroups.set(albumKey, release);
    } else {
      // We have a duplicate - decide which one to keep based on priority
      const existingRelease = albumGroups.get(albumKey)!;
      const betterRelease = chooseBetterRelease(existingRelease, release);
      
      if (betterRelease !== existingRelease) {
        console.log(`🔄 Replacing "${existingRelease.name}" (${existingRelease.id}) with better version (${release.id}) - has cover art: ${!!release.image}`);
        albumGroups.set(albumKey, betterRelease);
      } else {
        console.log(`🔄 Keeping existing "${release.name}" (${existingRelease.id}) over duplicate (${release.id})`);
      }
    }
  });
  
  const groupedReleases = Array.from(albumGroups.values());
  console.log(`🔍 After smart album grouping: ${groupedReleases.length} releases`);
  
  if (uniqueReleases.length !== groupedReleases.length) {
    console.log(`⚠️ Grouped ${uniqueReleases.length - groupedReleases.length} duplicate albums with smart prioritization`);
  }
  
  return groupedReleases;
};

// Smart release selection logic - prioritizes releases with better data
const chooseBetterRelease = (release1: FormattedRelease, release2: FormattedRelease): FormattedRelease => {
  // Priority 1: Prefer releases with cover art
  const release1HasImage = release1.image && release1.image.trim() !== '';
  const release2HasImage = release2.image && release2.image.trim() !== '';
  
  if (release1HasImage && !release2HasImage) {
    return release1;
  }
  if (release2HasImage && !release1HasImage) {
    return release2;
  }
  
  // Priority 2: Prefer digital media over physical media (often has better metadata)
  const release1IsDigital = isDigitalRelease(release1);
  const release2IsDigital = isDigitalRelease(release2);
  
  if (release1IsDigital && !release2IsDigital) {
    return release1;
  }
  if (release2IsDigital && !release1IsDigital) {
    return release2;
  }
  
  // Priority 3: Prefer more recent release dates (often remastered versions with better data)
  const date1 = new Date(release1.releaseDate || '1970-01-01');
  const date2 = new Date(release2.releaseDate || '1970-01-01');
  
  if (date2 > date1) {
    return release2;
  }
  
  // Default: keep the first one
  return release1;
};

// Helper function to detect digital releases
const isDigitalRelease = (release: FormattedRelease): boolean => {
  // This is a simple heuristic - in a real implementation, we'd check the actual format data
  // For now, we can use the release ID to make educated guesses, or check if it has cover art
  // as digital releases often have better metadata including cover art
  return !!release.image;
};