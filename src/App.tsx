import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import { LoginScreen, Sidebar, ReleaseList, ToastContainer } from './components';
import { FilterType, SortType } from './components/Sidebar';
import { useAuth } from './hooks/useAuth';
import { useOAuthCallback } from './hooks/useOAuthCallback';
import { useReleases } from './hooks/useReleases';
import { useRefreshReleases } from './hooks/useRefreshReleases';
import { useFilteredReleases } from './hooks/useFilteredReleases';
import { isClassical } from './lib/genres';
import { useToast } from './contexts/ToastContext';
import { useIsRestoring } from '@tanstack/react-query';

function App() {
  const isRestoring = useIsRestoring();
  const { isAuthenticated, login, logout } = useAuth();
  const { releases, lastUpdated } = useReleases();
  const { refresh, isRefreshing, progress, error: refreshError } = useRefreshReleases();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<FilterType>('7days');
  const [sort, setSort] = useState<SortType>('releaseDate');
  const [hideClassical, setHideClassical] = useState(false);

  useOAuthCallback();

  useEffect(() => {
    if (refreshError) {
      console.error('Refresh failed:', refreshError);
      showToast('Error fetching releases. Please try again.');
    }
  }, [refreshError, showToast]);

  // Applied before the sidebar sees the list so its counts match what's shown.
  const genreFiltered = useMemo(
    () => (hideClassical ? releases.filter(r => !isClassical(r.genres)) : releases),
    [releases, hideClassical],
  );

  const visibleReleases = useFilteredReleases(genreFiltered, filter, sort);

  const handleRefresh = () => {
    if (isRefreshing || !isAuthenticated) return;
    refresh();
  };

  const handleReleaseClick = (spotifyUrl: string) => {
    window.open(spotifyUrl, '_blank');
  };

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLogin={login} />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        releases={genreFiltered}
        filter={filter}
        sort={sort}
        lastUpdated={lastUpdated}
        hideClassical={hideClassical}
        onFilterChange={setFilter}
        onSortChange={setSort}
        onHideClassicalChange={setHideClassical}
        onLogout={logout}
        onRefresh={handleRefresh}
      />
      <div className="content-container">
        <main className="content">
          <ReleaseList
            isRestoring={isRestoring}
            isRefreshing={isRefreshing}
            progress={progress}
            releases={releases}
            visibleReleases={visibleReleases}
            onRefresh={handleRefresh}
            onReleaseClick={handleReleaseClick}
          />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
