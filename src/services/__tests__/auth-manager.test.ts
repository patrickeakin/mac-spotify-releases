import type { Mock, MockedFunction } from 'vitest';

vi.mock('../electron-storage', () => ({
  secureStorage: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../spotify-client', () => ({
  refreshAccessToken: vi.fn(),
}));

import { AuthManager } from '../auth-manager';
import { secureStorage } from '../electron-storage';
import { refreshAccessToken } from '../spotify-client';

const mockedRefresh = refreshAccessToken as MockedFunction<typeof refreshAccessToken>;
const mockedGet = secureStorage.get as Mock;
const mockedSet = secureStorage.set as Mock;
const mockedDelete = secureStorage.delete as Mock;

describe('AuthManager', () => {
  let store: Map<string, unknown>;

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-01T12:00:00Z').getTime());
    store = new Map();
    mockedGet.mockReset().mockImplementation(async (key: string) => store.get(key) ?? null);
    mockedSet.mockReset().mockImplementation(async (key: string, value: unknown) => { store.set(key, value); });
    mockedDelete.mockReset().mockImplementation(async (key: string) => { store.delete(key); });
    mockedRefresh.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrate is a no-op when no token is stored', async () => {
    const mgr = new AuthManager();
    await mgr.hydrate();
    expect(mgr.isAuthenticated()).toBe(false);
  });

  it('hydrate restores a previously-stored token', async () => {
    await secureStorage.set('spotify_token', {
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    const mgr = new AuthManager();
    await mgr.hydrate();
    expect(mgr.isAuthenticated()).toBe(true);
    expect(await mgr.getAccessToken()).toBe('a');
  });

  it('setTokens persists the token and notifies listeners', async () => {
    const mgr = new AuthManager();
    const events: boolean[] = [];
    mgr.onChange(authed => events.push(authed));

    await mgr.setTokens({ accessToken: 'a1', refreshToken: 'r1', expiresIn: 3600 });

    expect(mgr.isAuthenticated()).toBe(true);
    expect(events).toEqual([true]);
    expect(await secureStorage.get('spotify_token')).toMatchObject({
      accessToken: 'a1',
      refreshToken: 'r1',
    });
  });

  it('logout clears state, deletes the stored token, and notifies', async () => {
    const mgr = new AuthManager();
    await mgr.setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 });

    const events: boolean[] = [];
    mgr.onChange(authed => events.push(authed));

    await mgr.logout();
    expect(mgr.isAuthenticated()).toBe(false);
    expect(await secureStorage.get('spotify_token')).toBeNull();
    expect(events).toEqual([false]);
  });

  it('getAccessToken returns the current token when not near expiry', async () => {
    const mgr = new AuthManager();
    await mgr.setTokens({ accessToken: 'fresh', refreshToken: 'r', expiresIn: 3600 });
    expect(await mgr.getAccessToken()).toBe('fresh');
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('getAccessToken refreshes when within the 5-minute buffer', async () => {
    const mgr = new AuthManager();
    await mgr.setTokens({ accessToken: 'old', refreshToken: 'r-old', expiresIn: 60 });
    mockedRefresh.mockResolvedValueOnce({
      accessToken: 'new',
      refreshToken: 'r-new',
      expiresIn: 3600,
    });

    const token = await mgr.getAccessToken();
    expect(token).toBe('new');
    expect(mockedRefresh).toHaveBeenCalledWith('r-old');
    expect(await secureStorage.get('spotify_token')).toMatchObject({
      accessToken: 'new',
      refreshToken: 'r-new',
    });
  });

  it('getAccessToken throws AUTH_EXPIRED when no token is stored', async () => {
    const mgr = new AuthManager();
    await expect(mgr.getAccessToken()).rejects.toThrow('AUTH_EXPIRED');
  });

  it('concurrent refreshes coalesce into one network call', async () => {
    const mgr = new AuthManager();
    await mgr.setTokens({ accessToken: 'old', refreshToken: 'r', expiresIn: 60 });
    mockedRefresh.mockResolvedValueOnce({
      accessToken: 'new',
      refreshToken: 'r',
      expiresIn: 3600,
    });

    const [a, b, c] = await Promise.all([
      mgr.refresh(),
      mgr.refresh(),
      mgr.refresh(),
    ]);
    expect([a, b, c]).toEqual(['new', 'new', 'new']);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('refresh logs out and throws AUTH_EXPIRED on a 400 invalid_grant', async () => {
    const mgr = new AuthManager();
    await mgr.setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 60 });
    const authFailure = Object.assign(new Error('invalid_grant'), {
      response: { status: 400, data: { error: 'invalid_grant' } },
    });
    mockedRefresh.mockRejectedValueOnce(authFailure);

    const events: boolean[] = [];
    mgr.onChange(authed => events.push(authed));

    await expect(mgr.refresh()).rejects.toThrow('AUTH_EXPIRED');
    expect(mgr.isAuthenticated()).toBe(false);
    expect(events).toEqual([false]);
  });

  it('refresh preserves auth state on transient (non-4xx) failures', async () => {
    const mgr = new AuthManager();
    await mgr.setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 60 });

    const events: boolean[] = [];
    mgr.onChange(authed => events.push(authed));

    mockedRefresh.mockRejectedValueOnce(new Error('Network Error'));
    await expect(mgr.refresh()).rejects.toThrow('Network Error');
    expect(mgr.isAuthenticated()).toBe(true);

    const serverError = Object.assign(new Error('server'), {
      response: { status: 503 },
    });
    mockedRefresh.mockRejectedValueOnce(serverError);
    await expect(mgr.refresh()).rejects.toThrow('server');
    expect(mgr.isAuthenticated()).toBe(true);

    expect(events).toEqual([]);
  });
});
