import React from 'react';
import { CoverArt } from './CoverArt';
import { FormattedRelease } from '../services/types';

interface ReleaseCardProps {
  release: FormattedRelease;
  onClick: (spotifyUrl: string) => void;
}

export const ReleaseCard: React.FC<ReleaseCardProps> = ({ release, onClick }) => (
  <div
    className="release-card"
    onClick={() => onClick(release.spotifyUrl)}
    data-testid="release-card"
  >
    <CoverArt
      imageUrl={release.image}
      altText={`${release.name} by ${release.artist}`}
    />
    <div className="card-metadata">
      <div className="card-header">
        <h3 className="artist-name">{release.artist}</h3>
        <p className="release-title">{release.name}</p>
      </div>
      <div className="card-footer">
        <span className="release-date">
          {new Date(release.releaseDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <span className={`release-type ${release.type.toLowerCase()}`}>
          {release.type}
        </span>
      </div>
    </div>
  </div>
);
