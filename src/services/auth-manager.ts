import { SpotifyTokens } from './types';
import { secureStorage } from './electron-storage';
import { refreshAccessToken } from './spotify-client';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const TOKEN_KEY = 'spotify_token';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

type AuthListener = (authenticated: boolean) => void;

export class AuthManager {
  private current: StoredToken | null = null;
  private hydrated = false;
  private inflightRefresh: Promise<string> | null = null;
  private listeners = new Set<AuthListener>();

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    try {
      const stored = (await secureStorage.get(TOKEN_KEY)) as StoredToken | null;
      if (stored && stored.refreshToken && stored.accessToken) {
        this.current = stored;
      }
    } catch (error) {
      console.error('Failed to hydrate auth state:', error);
    }
    this.hydrated = true;
  }

  isAuthenticated(): boolean {
    return this.current !== null;
  }

  onChange(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const authed = this.isAuthenticated();
    this.listeners.forEach(l => {
      try {
        l(authed);
      } catch (error) {
        console.error('Auth listener threw:', error);
      }
    });
  }

  async getAccessToken(): Promise<string> {
    await this.hydrate();
    if (!this.current) {
      throw new Error('AUTH_EXPIRED');
    }
    if (this.current.expiresAt - REFRESH_BUFFER_MS <= Date.now()) {
      return this.refresh();
    }
    return this.current.accessToken;
  }

  async refresh(): Promise<string> {
    if (this.inflightRefresh) return this.inflightRefresh;

    this.inflightRefresh = (async () => {
      try {
        if (!this.current) {
          throw new Error('AUTH_EXPIRED');
        }
        const tokens = await refreshAccessToken(this.current.refreshToken);
        const next: StoredToken = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000
        };
        await secureStorage.set(TOKEN_KEY, next);
        this.current = next;
        return next.accessToken;
      } catch (error) {
        console.warn('Token refresh failed; clearing auth state', error);
        await this.logout();
        throw new Error('AUTH_EXPIRED');
      } finally {
        this.inflightRefresh = null;
      }
    })();

    return this.inflightRefresh;
  }

  async setTokens(tokens: SpotifyTokens): Promise<void> {
    const next: StoredToken = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000
    };
    await secureStorage.set(TOKEN_KEY, next);
    this.current = next;
    this.hydrated = true;
    this.notify();
  }

  async logout(): Promise<void> {
    this.current = null;
    await secureStorage.delete(TOKEN_KEY);
    this.notify();
  }
}

export const authManager = new AuthManager();
