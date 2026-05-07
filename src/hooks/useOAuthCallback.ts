import { useEffect } from 'react';
import {
  authManager,
  exchangeCodeForToken,
  getAccessTokenFromUrl,
  getAuthorizationCodeFromUrl,
} from '../services';
import { useToast } from '../contexts/ToastContext';

export function useOAuthCallback() {
  const { showToast } = useToast();

  useEffect(() => {
    const consumeBrowserCallback = async () => {
      const authCode = getAuthorizationCodeFromUrl();
      if (authCode) {
        try {
          const tokens = await exchangeCodeForToken(authCode);
          await authManager.setTokens(tokens);
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Failed to exchange code for token:', error);
          showToast('Authentication failed. Please try again.');
        }
        return;
      }
      // Backward-compat for the old implicit grant fragment.
      if (getAccessTokenFromUrl()) {
        console.warn('Received legacy implicit-grant token; please re-authenticate');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    consumeBrowserCallback();

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.onOAuthCallback) return;

    return electronAPI.onOAuthCallback(async (callbackData: string) => {
      const params = new URLSearchParams(callbackData);
      const code = params.get('code');
      const errorParam = params.get('error');

      if (errorParam) {
        showToast(`Authentication error: ${errorParam}`);
        return;
      }
      if (!code) return;

      try {
        const tokens = await exchangeCodeForToken(code);
        await authManager.setTokens(tokens);
      } catch (error) {
        console.error('Failed to exchange code for token:', error);
        showToast('Authentication failed. Please try again.');
      }
    });
  }, [showToast]);
}
