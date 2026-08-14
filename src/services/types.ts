// Shared types for the API modules

export interface SpotifyArtist {
  id: string;
  name: string;
  // Optional: artists cached before genre support was added won't have it.
  genres?: string[];
}

export interface SpotifyUserProfile {
  id: string;
  country: string;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SpotifyAlbumImage {
  url: string;
  height?: number;
  width?: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: 'album' | 'single' | 'compilation';
  album_group?: 'album' | 'single' | 'compilation' | 'appears_on';
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  images: SpotifyAlbumImage[];
  external_urls: { spotify: string };
  artists: Array<{ id: string; name: string }>;
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
  // Genres of the followed artist this release came from. Optional: releases
  // cached before genre support was added won't have it until the next refresh.
  genres?: string[];
}