import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient, useIsRestoring } from '@tanstack/react-query';
import './App.css';
import {
  authManager,
  exchangeCodeForToken,
  getAccessTokenFromUrl,
  getAuthUrl,
  getAuthorizationCodeFromUrl,
  SpotifyTokens,
} from './services';
import { CoverArt } from './components';
import { useReleases, RELEASES_QUERY_KEY } from './hooks/useReleases';
import { useRefreshReleases } from './hooks/useRefreshReleases';
import { ARTISTS_QUERY_KEY } from './hooks/useFollowedArtists';

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

type FilterType = 'today' | '7days' | '90days' | '6months';
type SortType = 'artist' | 'releaseDate';

function App() {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const { releases, lastUpdated } = useReleases();
  const { refresh, isRefreshing, progress, error: refreshError } = useRefreshReleases();

  const [filter, setFilter] = useState<FilterType>('7days');
  const [sort, setSort] = useState<SortType>('releaseDate');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    authManager.hydrate().then(() => setIsAuthenticated(authManager.isAuthenticated()));
    const unsubscribe = authManager.onChange(authed => {
      setIsAuthenticated(authed);
      if (!authed) {
        queryClient.removeQueries({ queryKey: RELEASES_QUERY_KEY });
        queryClient.removeQueries({ queryKey: ARTISTS_QUERY_KEY });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    if (refreshError) {
      console.error('Refresh failed:', refreshError);
      alert('Error fetching releases. Please try again.');
    }
  }, [refreshError]);

  useEffect(() => {
    const handleTokens = async (tokens: SpotifyTokens) => {
      await authManager.setTokens(tokens);
    };

    const consumeBrowserCallback = async () => {
      const authCode = getAuthorizationCodeFromUrl();
      if (authCode) {
        console.log('🔑 Authorization code received, exchanging for token...');
        try {
          const tokens = await exchangeCodeForToken(authCode);
          await handleTokens(tokens);
          console.log('✅ Authentication successful!');
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('❌ Failed to exchange code for token:', error);
          alert('Authentication failed. Please try again.');
        }
        return;
      }

      // Backward-compat for the old implicit grant fragment.
      const accessToken = getAccessTokenFromUrl();
      if (accessToken) {
        console.warn('Received legacy implicit-grant token; refresh-token flow is preferred — please re-authenticate');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    consumeBrowserCallback();

    const electronAPI = (window as any).electronAPI;
    let unsubscribe: (() => void) | undefined;

    if (electronAPI?.onOAuthCallback) {
      console.log('🎧 Setting up Electron OAuth callback listener');
      unsubscribe = electronAPI.onOAuthCallback(async (callbackData: string) => {
        console.log('📨 Received OAuth callback from Electron');
        const params = new URLSearchParams(callbackData);
        const code = params.get('code');
        const errorParam = params.get('error');

        if (errorParam) {
          console.error('❌ OAuth error:', errorParam);
          alert(`Authentication error: ${errorParam}`);
          return;
        }

        if (!code) {
          console.error('❌ No authorization code in callback');
          return;
        }

        try {
          const tokens = await exchangeCodeForToken(code);
          await handleTokens(tokens);
          console.log('✅ Authentication successful!');
        } catch (error) {
          console.error('❌ Failed to exchange code for token:', error);
          alert('Authentication failed. Please try again.');
        }
      });
    } else {
      console.log('⚠️ Not running in Electron or electronAPI not available');
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleLogin = async () => {
    const authUrl = await getAuthUrl();
    console.log('🚀 Starting OAuth flow with URL:', authUrl);

    if ((window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(authUrl);
    } else {
      window.location.href = authUrl;
    }
  };

  const handleLogout = async () => {
    await authManager.logout();
  };

  const handleRefreshArtists = () => {
    if (isRefreshing || !isAuthenticated) return;
    refresh();
  };

  const handleReleaseClick = (spotifyUrl: string) => {
    window.open(spotifyUrl, '_blank');
  };

  const filteredAndSortedReleases = useMemo(() => {
    return releases
      .filter(release => {
        const releaseDate = new Date(release.releaseDate);
        const now = new Date();
        switch (filter) {
          case 'today':
            return releaseDate.toDateString() === now.toDateString();
          case '7days':
            return releaseDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          case '90days':
            return releaseDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          case '6months':
            return releaseDate >= new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          default:
            return true;
        }
      })
      .sort((a, b) => {
        if (sort === 'artist') {
          return a.artist.localeCompare(b.artist);
        }
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      });
  }, [releases, filter, sort]);

  if (!isAuthenticated) {
    return (
      <main className="login-container">
        <div className="login">
          <img
            className="logo"
            src="./numu-logo-white.svg"
            alt="NUMU Logo"
            onClick={handleLogin}
            data-testid="login-logo"
          />
          <p className="login-instructions">CLICK TO LOGIN</p>
        </div>
      </main>
    );
  }

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="logo-container">
          <img className="sidebar-logo" src="./numu-logo-white.svg" alt="NUMU Logo" />
        </div>
        <div>
          <h3>DURATION</h3>
          <ul>
            <li
              className={filter === 'today' ? 'active' : ''}
              onClick={() => setFilter('today')}
              data-testid="filter-today"
            >
              <span>TODAY</span>
              {releases.length > 0 && (
                <span className="count">
                  {releases.filter(r => {
                    const date = new Date(r.releaseDate);
                    return date.toDateString() === new Date().toDateString();
                  }).length}
                </span>
              )}
            </li>
            <li
              className={filter === '7days' ? 'active' : ''}
              onClick={() => setFilter('7days')}
              data-testid="filter-7days"
            >
              <span>7 DAYS</span>
              {releases.length > 0 && (
                <span className="count">
                  {releases.filter(r => {
                    const date = new Date(r.releaseDate);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return date >= weekAgo;
                  }).length}
                </span>
              )}
            </li>
            <li
              className={filter === '90days' ? 'active' : ''}
              onClick={() => setFilter('90days')}
            >
              <span>90 DAYS</span>
              {releases.length > 0 && (
                <span className="count">
                  {releases.filter(r => {
                    const date = new Date(r.releaseDate);
                    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                    return date >= ninetyDaysAgo;
                  }).length}
                </span>
              )}
            </li>
            <li
              className={filter === '6months' ? 'active' : ''}
              onClick={() => setFilter('6months')}
            >
              <span>6 MONTHS</span>
              {releases.length > 0 && (
                <span className="count">{releases.length}</span>
              )}
            </li>
          </ul>
        </div>
        <div>
          <h3>ORDER</h3>
          <ul>
            <li
              className={sort === 'releaseDate' ? 'active' : ''}
              onClick={() => setSort('releaseDate')}
              data-testid="sort-recent"
            >
              RECENT
            </li>
            <li
              className={sort === 'artist' ? 'active' : ''}
              onClick={() => setSort('artist')}
              data-testid="sort-artist"
            >
              ARTIST
            </li>
          </ul>
        </div>
        <div>
          <h3
            className="clickable-button"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            LOGOUT
          </h3>
        </div>
        <div>
          <h3
            className="clickable-button"
            onClick={handleRefreshArtists}
            data-testid="refresh-artists-button"
          >
            REFRESH
          </h3>
          {lastUpdated && (
            <p className="last-updated" data-testid="last-updated">
              Updated {formatRelativeTime(lastUpdated)}
            </p>
          )}
        </div>
      </nav>

      <div className="content-container">
        <main className="content">
          {isRestoring ? (
            <div className="loading">
              <div className="loading-text">Loading…</div>
            </div>
          ) : isRefreshing ? (
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
                      style={{
                        width: `${(progress.current / progress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="loading-text">Loading new releases...</div>
              )}
            </div>
          ) : releases.length === 0 ? (
            <div className="initial-fetch-container">
              <div className="initial-fetch">
                <p>Click the button below to scan your followed artists for new releases.</p>
                <button
                  className="import-button"
                  onClick={handleRefreshArtists}
                  data-testid="import-artists-button"
                >
                  Import Followed Artists
                </button>
              </div>
            </div>
          ) : filteredAndSortedReleases.length === 0 ? (
            <div className="no-releases">No new releases found for the selected time period.</div>
          ) : (
            filteredAndSortedReleases.map(release => (
              <div
                key={release.id}
                className="release-card"
                onClick={() => handleReleaseClick(release.spotifyUrl)}
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
                        day: 'numeric'
                      })}
                    </span>
                    <span className={`release-type ${release.type.toLowerCase()}`}>
                      {release.type}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
