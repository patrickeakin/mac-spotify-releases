import React, { useEffect, useState } from 'react';
import './App.css';
import { LoginScreen, Sidebar, ReleaseList, ToastContainer } from './components';
import { FilterType, SortType } from './components/Sidebar';
import { useAuth } from './hooks/useAuth';
import { useOAuthCallback } from './hooks/useOAuthCallback';
import { useReleases } from './hooks/useReleases';
import { useRefreshReleases } from './hooks/useRefreshReleases';
import { useFilteredReleases } from './hooks/useFilteredReleases';
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

  useOAuthCallback();

  useEffect(() => {
    if (refreshError) {
      console.error('Refresh failed:', refreshError);
      showToast('Error fetching releases. Please try again.');
    }
  }, [refreshError, showToast]);

  const visibleReleases = useFilteredReleases(releases, filter, sort);

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
        releases={releases}
        filter={filter}
        sort={sort}
        lastUpdated={lastUpdated}
        onFilterChange={setFilter}
        onSortChange={setSort}
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
