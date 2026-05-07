import React from 'react';
import { FormattedRelease } from '../services/types';
import { RefreshProgress } from '../hooks/useRefreshReleases';
import { ReleaseCard } from './ReleaseCard';

interface ReleaseListProps {
  isRestoring: boolean;
  isRefreshing: boolean;
  progress: RefreshProgress;
  releases: FormattedRelease[];
  visibleReleases: FormattedRelease[];
  onRefresh: () => void;
  onReleaseClick: (spotifyUrl: string) => void;
}

export const ReleaseList: React.FC<ReleaseListProps> = ({
  isRestoring,
  isRefreshing,
  progress,
  releases,
  visibleReleases,
  onRefresh,
  onReleaseClick,
}) => {
  if (isRestoring) {
    return (
      <div className="loading">
        <div className="loading-text">Loading…</div>
      </div>
    );
  }

  if (isRefreshing) {
    return (
      <div className="loading">
        {progress.total > 0 ? (
          <div className="loading-progress">
            <div className="loading-text">Scanning artists for new releases...</div>
            <div className="loading-subtext" data-testid="progress-text">
              {progress.current} of {progress.total} artists checked
            </div>
            <div className="loading-count" data-testid="releases-count">
              Found {progress.newReleases} new releases so far
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="loading-text">Loading new releases...</div>
        )}
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="initial-fetch-container">
        <div className="initial-fetch">
          <p>Click the button below to scan your followed artists for new releases.</p>
          <button
            className="import-button"
            onClick={onRefresh}
            data-testid="import-artists-button"
          >
            Import Followed Artists
          </button>
        </div>
      </div>
    );
  }

  if (visibleReleases.length === 0) {
    return <div className="no-releases">No new releases found for the selected time period.</div>;
  }

  return (
    <>
      {visibleReleases.map(release => (
        <ReleaseCard key={release.id} release={release} onClick={onReleaseClick} />
      ))}
    </>
  );
};
