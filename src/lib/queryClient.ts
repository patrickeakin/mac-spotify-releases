import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { storage } from '../services/electron-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
    },
  },
});

const asyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const value = await storage.get(key);
    return typeof value === 'string' ? value : null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await storage.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await storage.delete(key);
  },
};

export const persister = createAsyncStoragePersister({
  storage: asyncStorage,
  key: 'numu_query_cache',
  throttleTime: 1000,
});
