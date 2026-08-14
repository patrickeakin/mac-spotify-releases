import { FormattedRelease, SpotifyAlbum, SpotifyArtist } from './types';
import { getArtistAlbums } from './spotify-client';

const DEFAULT_DAYS_BACK = 180;
const INTER_REQUEST_DELAY_MS = 50;

const parseReleaseDate = (album: SpotifyAlbum): Date => {
  // release_date can be "YYYY-MM-DD", "YYYY-MM", or "YYYY" depending on precision.
  // Pad to a full date so Date parsing is consistent across precisions.
  switch (album.release_date_precision) {
    case 'year':
      return new Date(`${album.release_date}-01-01`);
    case 'month':
      return new Date(`${album.release_date}-01`);
    default:
      return new Date(album.release_date);
  }
};

const albumToFormattedRelease = (album: SpotifyAlbum, primaryArtist: SpotifyArtist): FormattedRelease => {
  // Prefer the followed-artist credit when present so deduped releases stay attributed to "your" artist.
  const credited = album.artists.find(a => a.id === primaryArtist.id) ?? album.artists[0];
  return {
    id: album.id,
    name: album.name,
    artist: credited?.name ?? primaryArtist.name,
    artistId: credited?.id ?? primaryArtist.id,
    image: album.images[0]?.url ?? '',
    releaseDate: album.release_date,
    type: album.album_type,
    spotifyUrl: album.external_urls.spotify,
    source: 'spotify',
    // Albums carry no usable genres of their own; genres live on the artist.
    // Use the followed artist's, since that's the one we looked this album up by.
    genres: primaryArtist.genres ?? []
  };
};

export const getNewReleasesFromSpotify = async (
  market: string,
  followedArtists: SpotifyArtist[],
  onProgress?: (current: number, total: number, newReleases: number) => void,
  daysBack: number = DEFAULT_DAYS_BACK,
  now: Date = new Date()
): Promise<FormattedRelease[]> => {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - daysBack);

  const seenAlbumIds = new Set<string>();
  const releases: FormattedRelease[] = [];

  for (let i = 0; i < followedArtists.length; i++) {
    const artist = followedArtists[i];

    try {
      const albums = await getArtistAlbums(artist.id, market);

      for (const album of albums) {
        if (seenAlbumIds.has(album.id)) continue;
        if (parseReleaseDate(album) < cutoff) continue;
        seenAlbumIds.add(album.id);
        releases.push(albumToFormattedRelease(album, artist));
      }
    } catch (error: any) {
      if (error.message === 'AUTH_EXPIRED') {
        throw error;
      }
      console.error(`Failed to fetch albums for ${artist.name}:`, error);
    }

    if (onProgress) {
      onProgress(i + 1, followedArtists.length, releases.length);
    }

    if (i < followedArtists.length - 1) {
      await new Promise(resolve => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
    }
  }

  return releases;
};
