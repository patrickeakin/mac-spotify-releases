import { useMemo } from 'react';
import { FormattedRelease } from '../services/types';
import { FilterType, SortType } from '../components/Sidebar';
import { parseReleaseDate } from '../lib/dates';

const DAYS = {
  '7days': 7,
  '90days': 90,
  '6months': 180,
} as const;

export function useFilteredReleases(
  releases: FormattedRelease[],
  filter: FilterType,
  sort: SortType,
): FormattedRelease[] {
  return useMemo(() => {
    const now = new Date();
    const matchesFilter = (release: FormattedRelease) => {
      const releaseDate = parseReleaseDate(release.releaseDate);
      if (filter === 'today') {
        return releaseDate.toDateString() === now.toDateString();
      }
      const cutoff = new Date(now.getTime() - DAYS[filter] * 24 * 60 * 60 * 1000);
      return releaseDate >= cutoff;
    };

    return releases
      .filter(matchesFilter)
      .sort((a, b) => {
        if (sort === 'artist') return a.artist.localeCompare(b.artist);
        return parseReleaseDate(b.releaseDate).getTime() - parseReleaseDate(a.releaseDate).getTime();
      });
  }, [releases, filter, sort]);
}
