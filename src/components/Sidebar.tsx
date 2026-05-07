import React from 'react';
import { FormattedRelease } from '../services/types';
import { parseReleaseDate } from '../lib/dates';

export type FilterType = 'today' | '7days' | '90days' | '6months';
export type SortType = 'artist' | 'releaseDate';

interface SidebarProps {
  releases: FormattedRelease[];
  filter: FilterType;
  sort: SortType;
  lastUpdated: number | null;
  onFilterChange: (filter: FilterType) => void;
  onSortChange: (sort: SortType) => void;
  onLogout: () => void;
  onRefresh: () => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const countWithin = (releases: FormattedRelease[], days: number): number => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return releases.filter(r => parseReleaseDate(r.releaseDate).getTime() >= cutoff).length;
};

const countToday = (releases: FormattedRelease[]): number => {
  const today = new Date().toDateString();
  return releases.filter(r => parseReleaseDate(r.releaseDate).toDateString() === today).length;
};

export const Sidebar: React.FC<SidebarProps> = ({
  releases,
  filter,
  sort,
  lastUpdated,
  onFilterChange,
  onSortChange,
  onLogout,
  onRefresh,
}) => {
  const hasReleases = releases.length > 0;

  return (
    <nav className="sidebar">
      <div className="logo-container">
        <img className="sidebar-logo" src="./numu-logo-white.svg" alt="NUMU Logo" />
      </div>
      <div>
        <h3>DURATION</h3>
        <ul>
          <li
            className={filter === 'today' ? 'active' : ''}
            onClick={() => onFilterChange('today')}
            data-testid="filter-today"
          >
            <span>TODAY</span>
            {hasReleases && <span className="count">{countToday(releases)}</span>}
          </li>
          <li
            className={filter === '7days' ? 'active' : ''}
            onClick={() => onFilterChange('7days')}
            data-testid="filter-7days"
          >
            <span>7 DAYS</span>
            {hasReleases && <span className="count">{countWithin(releases, 7)}</span>}
          </li>
          <li
            className={filter === '90days' ? 'active' : ''}
            onClick={() => onFilterChange('90days')}
          >
            <span>90 DAYS</span>
            {hasReleases && <span className="count">{countWithin(releases, 90)}</span>}
          </li>
          <li
            className={filter === '6months' ? 'active' : ''}
            onClick={() => onFilterChange('6months')}
          >
            <span>6 MONTHS</span>
            {hasReleases && <span className="count">{releases.length}</span>}
          </li>
        </ul>
      </div>
      <div>
        <h3>ORDER</h3>
        <ul>
          <li
            className={sort === 'releaseDate' ? 'active' : ''}
            onClick={() => onSortChange('releaseDate')}
            data-testid="sort-recent"
          >
            RECENT
          </li>
          <li
            className={sort === 'artist' ? 'active' : ''}
            onClick={() => onSortChange('artist')}
            data-testid="sort-artist"
          >
            ARTIST
          </li>
        </ul>
      </div>
      <div>
        <h3 className="clickable-button" onClick={onLogout} data-testid="logout-button">
          LOGOUT
        </h3>
      </div>
      <div>
        <h3 className="clickable-button" onClick={onRefresh} data-testid="refresh-artists-button">
          REFRESH
        </h3>
        {lastUpdated && (
          <p className="last-updated" data-testid="last-updated">
            Updated {formatRelativeTime(lastUpdated)}
          </p>
        )}
      </div>
    </nav>
  );
};
