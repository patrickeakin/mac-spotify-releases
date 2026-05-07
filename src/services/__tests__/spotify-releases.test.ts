import type { MockedFunction } from 'vitest';
import { getNewReleasesFromSpotify } from '../spotify-releases';
import { SpotifyAlbum, SpotifyArtist, FormattedRelease } from '../types';

vi.mock('../spotify-client', () => ({
  getArtistAlbums: vi.fn(),
}));

import { getArtistAlbums } from '../spotify-client';

const mockGetArtistAlbums = getArtistAlbums as MockedFunction<typeof getArtistAlbums>;

const FIXED_NOW = new Date('2026-05-01T00:00:00Z');

const album = (overrides: Partial<SpotifyAlbum> = {}): SpotifyAlbum => ({
  id: 'album1',
  name: 'Album One',
  album_type: 'album',
  release_date: '2026-04-01',
  release_date_precision: 'day',
  images: [{ url: 'https://img/1.jpg' }],
  external_urls: { spotify: 'https://open.spotify.com/album/album1' },
  artists: [{ id: 'artist1', name: 'Artist One' }],
  ...overrides,
});

const artist = (id: string, name: string): SpotifyArtist => ({ id, name });

const callRelease = (
  artists: SpotifyArtist[],
  opts: {
    onProgress?: (cur: number, total: number, count: number) => void;
    daysBack?: number;
  } = {},
): Promise<FormattedRelease[]> =>
  getNewReleasesFromSpotify('US', artists, opts.onProgress, opts.daysBack ?? 180, FIXED_NOW);

describe('getNewReleasesFromSpotify', () => {
  beforeEach(() => {
    mockGetArtistAlbums.mockReset();
  });

  it('maps album fields into FormattedRelease shape', async () => {
    mockGetArtistAlbums.mockResolvedValueOnce([album()]);
    const results = await callRelease([artist('artist1', 'Artist One')]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'album1',
      name: 'Album One',
      artist: 'Artist One',
      artistId: 'artist1',
      image: 'https://img/1.jpg',
      releaseDate: '2026-04-01',
      type: 'album',
      spotifyUrl: 'https://open.spotify.com/album/album1',
      source: 'spotify',
    });
  });

  it('filters out releases older than the cutoff', async () => {
    mockGetArtistAlbums.mockResolvedValueOnce([
      album({ id: 'recent', release_date: '2026-04-15' }),
      album({ id: 'old', release_date: '2024-01-01' }),
    ]);
    const results = await callRelease([artist('artist1', 'Artist One')]);
    expect(results.map(r => r.id)).toEqual(['recent']);
  });

  it('dedupes the same album appearing across multiple followed artists', async () => {
    const collab = album({
      id: 'collab',
      artists: [
        { id: 'artist1', name: 'Artist One' },
        { id: 'artist2', name: 'Artist Two' },
      ],
    });
    mockGetArtistAlbums
      .mockResolvedValueOnce([collab])
      .mockResolvedValueOnce([collab]);
    const results = await callRelease([
      artist('artist1', 'Artist One'),
      artist('artist2', 'Artist Two'),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('collab');
  });

  it('handles year and month release_date_precision', async () => {
    mockGetArtistAlbums.mockResolvedValueOnce([
      album({ id: 'year', release_date: '2026', release_date_precision: 'year' }),
      album({ id: 'month', release_date: '2026-04', release_date_precision: 'month' }),
      album({ id: 'old-year', release_date: '2020', release_date_precision: 'year' }),
    ]);
    const results = await callRelease([artist('artist1', 'Artist One')]);
    expect(results.map(r => r.id).sort()).toEqual(['month', 'year']);
  });

  it('reports progress per artist with running release count', async () => {
    mockGetArtistAlbums
      .mockResolvedValueOnce([album({ id: 'a' })])
      .mockResolvedValueOnce([album({ id: 'b' }), album({ id: 'c' })]);
    const progress: Array<[number, number, number]> = [];
    await callRelease(
      [artist('artist1', 'A1'), artist('artist2', 'A2')],
      { onProgress: (cur, total, count) => progress.push([cur, total, count]) },
    );
    expect(progress).toEqual([
      [1, 2, 1],
      [2, 2, 3],
    ]);
  });

  it('continues past per-artist failures', async () => {
    mockGetArtistAlbums
      .mockResolvedValueOnce([album({ id: 'ok' })])
      .mockRejectedValueOnce(new Error('network blip'));
    const results = await callRelease([
      artist('artist1', 'A1'),
      artist('artist2', 'A2'),
    ]);
    expect(results.map(r => r.id)).toEqual(['ok']);
  });

  it('rethrows AUTH_EXPIRED instead of swallowing it', async () => {
    mockGetArtistAlbums
      .mockResolvedValueOnce([album({ id: 'ok2' })])
      .mockRejectedValueOnce(new Error('AUTH_EXPIRED'));
    await expect(
      callRelease([artist('a1', 'A1'), artist('a2', 'A2')]),
    ).rejects.toThrow('AUTH_EXPIRED');
  });

  it('attributes the release to the followed artist when they appear in album.artists', async () => {
    mockGetArtistAlbums.mockResolvedValueOnce([
      album({
        id: 'x',
        artists: [
          { id: 'main', name: 'Main Act' },
          { id: 'followed', name: 'Followed Artist' },
        ],
      }),
    ]);
    const results = await callRelease([artist('followed', 'Followed Artist')]);
    expect(results[0]).toMatchObject({ artistId: 'followed', artist: 'Followed Artist' });
  });
});
