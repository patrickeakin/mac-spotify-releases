// Storage service that uses electron-store when available, falls back to localStorage

interface ElectronAPI {
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

class StorageService {
  private isElectron(): boolean {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
  }

  async get(key: string): Promise<any> {
    if (this.isElectron()) {
      return await window.electronAPI!.store.get(key);
    } else {
      // Fallback to localStorage for web
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : undefined;
    }
  }

  async set(key: string, value: any): Promise<void> {
    if (this.isElectron()) {
      await window.electronAPI!.store.set(key, value);
    } else {
      // Fallback to localStorage for web
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  async delete(key: string): Promise<void> {
    if (this.isElectron()) {
      await window.electronAPI!.store.delete(key);
    } else {
      // Fallback to localStorage for web
      localStorage.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    if (this.isElectron()) {
      await window.electronAPI!.store.clear();
    } else {
      // Fallback to localStorage for web
      localStorage.clear();
    }
  }

  // Convenience methods for specific data
  async getAccessToken(): Promise<string | null> {
    return await this.get('spotify_access_token');
  }

  async setAccessToken(token: string): Promise<void> {
    await this.set('spotify_access_token', token);
  }

  async removeAccessToken(): Promise<void> {
    await this.delete('spotify_access_token');
  }

  // Artists storage
  async getFollowedArtists(): Promise<any[]> {
    return (await this.get('followed_artists')) || [];
  }

  async setFollowedArtists(artists: any[]): Promise<void> {
    await this.set('followed_artists', artists);
    await this.set('artists_last_updated', new Date().toISOString());
  }

  async getArtistsLastUpdated(): Promise<string | null> {
    return await this.get('artists_last_updated');
  }

  // Releases storage
  async getReleases(): Promise<any[]> {
    return (await this.get('cached_releases')) || [];
  }

  async setReleases(releases: any[]): Promise<void> {
    await this.set('cached_releases', releases);
    await this.set('releases_last_updated', new Date().toISOString());
  }

  async getReleasesLastUpdated(): Promise<string | null> {
    return await this.get('releases_last_updated');
  }

  // Cache management
  async clearReleaseCache(): Promise<void> {
    await this.delete('cached_releases');
    await this.delete('releases_last_updated');
  }

  async clearArtistCache(): Promise<void> {
    await this.delete('followed_artists');
    await this.delete('artists_last_updated');
  }
}

export const storage = new StorageService();