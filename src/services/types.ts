// Shared types for the API modules

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface MusicBrainzRelease {
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

export interface UnifiedCacheData {
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