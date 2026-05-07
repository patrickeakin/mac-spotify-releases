interface ElectronAPI {
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
  };
  secureStore: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const isElectron = (): boolean =>
  typeof window !== 'undefined' && window.electronAPI !== undefined;

class StorageService {
  async get(key: string): Promise<any> {
    if (isElectron()) {
      return await window.electronAPI!.store.get(key);
    }
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : undefined;
  }

  async set(key: string, value: any): Promise<void> {
    if (isElectron()) {
      await window.electronAPI!.store.set(key, value);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    if (isElectron()) {
      await window.electronAPI!.store.delete(key);
      return;
    }
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (isElectron()) {
      await window.electronAPI!.store.clear();
      return;
    }
    localStorage.clear();
  }
}

class SecureStorageService {
  async get(key: string): Promise<any> {
    if (isElectron()) {
      return await window.electronAPI!.secureStore.get(key);
    }
    const item = localStorage.getItem(`secure_${key}`);
    return item ? JSON.parse(item) : null;
  }

  async set(key: string, value: any): Promise<void> {
    if (isElectron()) {
      await window.electronAPI!.secureStore.set(key, value);
      return;
    }
    localStorage.setItem(`secure_${key}`, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    if (isElectron()) {
      await window.electronAPI!.secureStore.delete(key);
      return;
    }
    localStorage.removeItem(`secure_${key}`);
  }
}

export const storage = new StorageService();
export const secureStorage = new SecureStorageService();
