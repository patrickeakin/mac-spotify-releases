import { renderHook } from '@testing-library/react';
import { useFilteredReleases } from '../useFilteredReleases';
import { FormattedRelease } from '../../services/types';
import { FilterType, SortType } from '../../components/Sidebar';

const FIXED_NOW = new Date('2026-05-15T00:00:00Z');

const release = (overrides: Partial<FormattedRelease> = {}): FormattedRelease => ({
  id: 'r1',
  name: 'Album',
  artist: 'Artist',
  artistId: 'a1',
  image: '',
  releaseDate: '2026-05-10',
  type: 'album',
  spotifyUrl: 'https://open.spotify.com/album/r1',
  source: 'spotify',
  ...overrides,
});

const renderFiltered = (
  releases: FormattedRelease[],
  filter: FilterType,
  sort: SortType,
) => renderHook(() => useFilteredReleases(releases, filter, sort)).result.current;

describe('useFilteredReleases', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('date filter', () => {
    it('today only matches releases with today\'s date', () => {
      const releases = [
        release({ id: 'today', releaseDate: '2026-05-15' }),
        release({ id: 'yesterday', releaseDate: '2026-05-14' }),
        release({ id: 'last-week', releaseDate: '2026-05-08' }),
      ];
      expect(renderFiltered(releases, 'today', 'releaseDate').map(r => r.id)).toEqual(['today']);
    });

    it('7days includes the last 7 days', () => {
      const releases = [
        release({ id: 'today', releaseDate: '2026-05-15' }),
        release({ id: 'six-days-ago', releaseDate: '2026-05-09' }),
        release({ id: 'eight-days-ago', releaseDate: '2026-05-07' }),
      ];
      expect(renderFiltered(releases, '7days', 'releaseDate').map(r => r.id).sort()).toEqual([
        'six-days-ago',
        'today',
      ]);
    });

    it('90days includes the last 90 days', () => {
      const releases = [
        release({ id: 'recent', releaseDate: '2026-05-01' }),
        release({ id: 'eighty-days', releaseDate: '2026-02-25' }),
        release({ id: 'ancient', releaseDate: '2025-01-01' }),
      ];
      expect(renderFiltered(releases, '90days', 'releaseDate').map(r => r.id).sort()).toEqual([
        'eighty-days',
        'recent',
      ]);
    });

    it('6months includes the last 180 days', () => {
      const releases = [
        release({ id: 'within', releaseDate: '2025-12-01' }),
        release({ id: 'border', releaseDate: '2025-11-16' }),
        release({ id: 'outside', releaseDate: '2025-10-01' }),
      ];
      expect(renderFiltered(releases, '6months', 'releaseDate').map(r => r.id).sort()).toEqual([
        'border',
        'within',
      ]);
    });
  });

  describe('sort order', () => {
    it('releaseDate sorts most recent first', () => {
      const releases = [
        release({ id: 'older', releaseDate: '2026-05-01' }),
        release({ id: 'newest', releaseDate: '2026-05-14' }),
        release({ id: 'middle', releaseDate: '2026-05-10' }),
      ];
      expect(renderFiltered(releases, '6months', 'releaseDate').map(r => r.id)).toEqual([
        'newest',
        'middle',
        'older',
      ]);
    });

    it('artist sorts alphabetically by artist name', () => {
      const releases = [
        release({ id: '1', artist: 'Charlie' }),
        release({ id: '2', artist: 'Alice' }),
        release({ id: '3', artist: 'Bob' }),
      ];
      expect(renderFiltered(releases, '6months', 'artist').map(r => r.artist)).toEqual([
        'Alice',
        'Bob',
        'Charlie',
      ]);
    });

    it('artist sort is case-insensitive', () => {
      const releases = [
        release({ id: '1', artist: 'bob' }),
        release({ id: '2', artist: 'Alice' }),
      ];
      expect(renderFiltered(releases, '6months', 'artist').map(r => r.artist)).toEqual([
        'Alice',
        'bob',
      ]);
    });
  });

  it('returns an empty array when nothing matches the filter', () => {
    const releases = [release({ releaseDate: '2020-01-01' })];
    expect(renderFiltered(releases, 'today', 'releaseDate')).toEqual([]);
  });
});
