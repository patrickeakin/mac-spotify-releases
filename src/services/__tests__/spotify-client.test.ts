import type { Mock } from 'vitest';

vi.mock('axios', () => ({
  default: vi.fn(),
}));

vi.mock('../auth-manager', () => ({
  authManager: {
    getAccessToken: vi.fn(),
    refresh: vi.fn(),
  },
}));

import axios from 'axios';
import { authManager } from '../auth-manager';
import { getUserProfile } from '../spotify-client';

const mockedAxios = axios as unknown as Mock;
const mockedGetAccessToken = authManager.getAccessToken as Mock;
const mockedRefresh = authManager.refresh as Mock;

const make401 = () =>
  Object.assign(new Error('Unauthorized'), { response: { status: 401, headers: {} } });

describe('spotifyRequest 401 retry path (via getUserProfile)', () => {
  beforeEach(() => {
    mockedAxios.mockReset();
    mockedGetAccessToken.mockReset();
    mockedRefresh.mockReset();
  });

  it('refreshes once and retries with the new token on 401', async () => {
    mockedGetAccessToken.mockResolvedValueOnce('expired-token');
    mockedRefresh.mockResolvedValueOnce('fresh-token');
    mockedAxios
      .mockRejectedValueOnce(make401())
      .mockResolvedValueOnce({ data: { id: 'user-1', country: 'US' } });

    const profile = await getUserProfile();

    expect(profile).toEqual({ id: 'user-1', country: 'US' });
    expect(mockedAxios).toHaveBeenCalledTimes(2);
    expect(mockedAxios.mock.calls[0][0].headers.Authorization).toBe('Bearer expired-token');
    expect(mockedAxios.mock.calls[1][0].headers.Authorization).toBe('Bearer fresh-token');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('throws AUTH_EXPIRED when refresh itself fails', async () => {
    mockedGetAccessToken.mockResolvedValueOnce('expired-token');
    mockedRefresh.mockRejectedValueOnce(new Error('refresh boom'));
    mockedAxios.mockRejectedValueOnce(make401());

    await expect(getUserProfile()).rejects.toThrow('AUTH_EXPIRED');
    expect(mockedAxios).toHaveBeenCalledTimes(1);
  });

  it('throws AUTH_EXPIRED when the retry request also returns 401', async () => {
    mockedGetAccessToken.mockResolvedValueOnce('token-a');
    mockedRefresh.mockResolvedValueOnce('token-b');
    mockedAxios
      .mockRejectedValueOnce(make401())
      .mockRejectedValueOnce(make401());

    await expect(getUserProfile()).rejects.toThrow('AUTH_EXPIRED');
    expect(mockedAxios).toHaveBeenCalledTimes(2);
  });

  it('does not refresh on non-401 errors', async () => {
    mockedGetAccessToken.mockResolvedValueOnce('token-a');
    const serverError = Object.assign(new Error('server'), { response: { status: 500 } });
    mockedAxios.mockRejectedValueOnce(serverError);

    await expect(getUserProfile()).rejects.toThrow('server');
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('falls back to country=US when /me omits country', async () => {
    mockedGetAccessToken.mockResolvedValueOnce('token-a');
    mockedAxios.mockResolvedValueOnce({ data: { id: 'user-1' } });

    expect(await getUserProfile()).toEqual({ id: 'user-1', country: 'US' });
  });
});
