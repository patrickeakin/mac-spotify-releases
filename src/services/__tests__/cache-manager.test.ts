import { getCachedData, cacheData, clearUnifiedCache } from '../cache-manager';
import { UnifiedCacheData } from '../types';

const buildFixture = (overrides: Partial<UnifiedCacheData> = {}): UnifiedCacheData => ({
  followedArtists: [{ id: 'a1', name: 'Artist One' }],
  artistsFetchedAt: 1_000,
  releases: [
    {
      id: 'r1',
      name: 'Release One',
      artist: 'Artist One',
      artistId: 'a1',
      image: '',
      releaseDate: '2026-01-01',
      type: 'album',
      spotifyUrl: 'https://open.spotify.com/album/r1',
      source: 'spotify',
    },
  ],
  lastProcessedArtistIndex: 1,
  totalArtists: 1,
  isComplete: true,
  timestamp: 2_000,
  userId: 'user-1',
  ...overrides,
});

describe('cache-manager (Electron IPC path)', () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    (window as any).electronAPI = {
      store: {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve(true);
        }),
        delete: vi.fn((key: string) => {
          store.delete(key);
          return Promise.resolve(true);
        }),
        clear: vi.fn(() => {
          store.clear();
          return Promise.resolve(true);
        }),
      },
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('returns null when nothing has been cached', async () => {
    expect(await getCachedData()).toBeNull();
  });

  it('round-trips a cache write through the IPC store', async () => {
    const fixture = buildFixture();
    await cacheData(fixture);
    const result = await getCachedData();
    expect(result).toEqual(fixture);
  });

  it('does not expire data based on age (no TTL)', async () => {
    const ancient = buildFixture({ timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000 });
    await cacheData(ancient);
    const result = await getCachedData();
    expect(result).toEqual(ancient);
  });

  it('clearUnifiedCache removes the entry', async () => {
    await cacheData(buildFixture());
    await clearUnifiedCache();
    expect(await getCachedData()).toBeNull();
  });
});

describe('cache-manager (browser localStorage fallback)', () => {
  beforeEach(() => {
    delete (window as any).electronAPI;
    localStorage.clear();
  });

  it('round-trips through localStorage when electronAPI is absent', async () => {
    const fixture = buildFixture();
    await cacheData(fixture);
    const result = await getCachedData();
    expect(result).toEqual(fixture);
  });
});
