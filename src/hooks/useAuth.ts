import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authManager, getAuthUrl } from '../services';
import { RELEASES_QUERY_KEY } from './useReleases';
import { ARTISTS_QUERY_KEY } from './useFollowedArtists';

export function useAuth() {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    authManager.hydrate().then(() => setIsAuthenticated(authManager.isAuthenticated()));
    return authManager.onChange(authed => {
      setIsAuthenticated(authed);
      if (!authed) {
        queryClient.removeQueries({ queryKey: RELEASES_QUERY_KEY });
        queryClient.removeQueries({ queryKey: ARTISTS_QUERY_KEY });
      }
    });
  }, [queryClient]);

  const login = useCallback(async () => {
    const authUrl = await getAuthUrl();
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openExternal) {
      electronAPI.openExternal(authUrl);
    } else {
      window.location.href = authUrl;
    }
  }, []);

  const logout = useCallback(() => authManager.logout(), []);

  return { isAuthenticated, login, logout };
}
