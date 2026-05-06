import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './App.css';
import {
  authManager,
  clearUnifiedCache,
  exchangeCodeForToken,
  getAccessTokenFromUrl,
  getAuthUrl,
  getAuthorizationCodeFromUrl,
  getCachedData,
  getNewReleasesUnified,
  SpotifyTokens
} from './services';
import { CoverArt } from './components';

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

interface Release {
  id: string;
  name: string;
  artist: string;
  artistId?: string;
  image: string;
  releaseDate: string;
  type: string;
  spotifyUrl: string;
  source?: string;
}

type FilterType = 'today' | '7days' | '90days' | '6months';
type SortType = 'artist' | 'releaseDate';

function App() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<FilterType>('7days');
  const [sort, setSort] = useState<SortType>('releaseDate');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, newReleases: 0 });
  const [hydrated, setHydrated] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchReleases = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const newAbortController = new AbortController();
    abortControllerRef.current = newAbortController;

    try {
      setLoading(true);
      setLoadingProgress({ current: 0, total: 0, newReleases: 0 });

      console.log('🔄 Fetching releases using unified API...');

      const releases = await getNewReleasesUnified((current, total, newReleasesCount) => {
        if (!newAbortController.signal.aborted) {
          setLoadingProgress({ current, total, newReleases: newReleasesCount });
        }
      });

      if (!newAbortController.signal.aborted) {
        setReleases(releases);
        setLastUpdated(Date.now());
        console.log(`✅ Successfully loaded ${releases.length} releases`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch was cancelled');
        return;
      }
      if (error.message === 'AUTH_EXPIRED') {
        console.warn('Auth expired during fetch — user must re-authenticate');
        return;
      }
      console.error('Error fetching releases:', error);
      alert('Error fetching releases. Please try again.');
    } finally {
      if (!newAbortController.signal.aborted) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await authManager.hydrate();
      setIsAuthenticated(authManager.isAuthenticated());

      const cached = await getCachedData();
      if (cached?.releases?.length) {
        setReleases(cached.releases);
      }
      if (cached?.timestamp) {
        setLastUpdated(cached.timestamp);
      }
      setHydrated(true);
    };
    init();

    const unsubscribe = authManager.onChange(authed => {
      setIsAuthenticated(authed);
      if (!authed) {
        setReleases([]);
        setLastUpdated(null);
      }
    });

    return () => {
      unsubscribe();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
      console.log('💻 Running in Electron, opening external browser');
      (window as any).electronAPI.openExternal(authUrl);
    } else {
      console.log('🌐 Running in browser, redirecting');
      window.location.href = authUrl;
    }
  };

  const handleLogout = async () => {
    await authManager.logout();
    await clearUnifiedCache();
    setReleases([]);
    setLastUpdated(null);
  };

  const handleRefreshArtists = async () => {
    if (loading) {
      console.log('Refresh already in progress, ignoring');
      return;
    }
    if (!isAuthenticated) return;

    await clearUnifiedCache();
    fetchReleases();
  };

  const handleInitialFetch = () => {
    if (loading) return;
    if (!isAuthenticated) return;
    fetchReleases();
  };

  const handleReleaseClick = (spotifyUrl: string) => {
    window.open(spotifyUrl, '_blank');
  };

  const filteredAndSortedReleases = useMemo(() => {
    return releases
      .filter(release => {
        const releaseDate = new Date(release.releaseDate);
        const now = new Date();
        let dateMatch = false;

        switch (filter) {
          case 'today':
            dateMatch = releaseDate.toDateString() === now.toDateString();
            break;
          case '7days':
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateMatch = releaseDate >= sevenDaysAgo;
            break;
          case '90days':
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            dateMatch = releaseDate >= ninetyDaysAgo;
            break;
          case '6months':
            const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            dateMatch = releaseDate >= sixMonthsAgo;
            break;
          default:
            dateMatch = true;
        }
        return dateMatch;
      })
      .sort((a, b) => {
        if (sort === 'artist') {
          return a.artist.localeCompare(b.artist);
        } else {
          return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        }
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
          {!hydrated ? (
            <div className="loading">
              <div className="loading-text">Loading…</div>
            </div>
          ) : loading ? (
            <div className="loading">
              {loadingProgress.total > 0 ? (
                <div className="loading-progress">
                  <div className="loading-text">Scanning artists for new releases...</div>
                  <div className="loading-subtext" data-testid="progress-text">
                    {loadingProgress.current} of {loadingProgress.total} artists checked
                  </div>
                  <div className="loading-count" data-testid="releases-count">
                    Found {loadingProgress.newReleases} new releases so far
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${(loadingProgress.current / loadingProgress.total) * 100}%`
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
                  onClick={handleInitialFetch}
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
