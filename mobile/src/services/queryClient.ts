import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';
import { STORAGE_KEYS } from '@/storage/keys';

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Offline-first: queries are persisted to AsyncStorage and hydrated on launch, so the LAST REAL
 * response is shown (with its timestamp) when the network is down. No synthetic fallbacks exist.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: ONE_WEEK,
      retry: (count, err) => {
        if (err instanceof ApiError && (err.code === 'unauthorized' || err.code === 'invalid_location' || err.code === 'validation')) {
          return false;
        }
        return count < 2;
      },
      refetchOnReconnect: true,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: STORAGE_KEYS.queryCache,
  throttleTime: 1000,
});

export const PERSIST_MAX_AGE = ONE_WEEK;
