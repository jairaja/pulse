import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  focusManager,
  onlineManager,
  QueryClient,
  type QueryKey
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { PulseApiError } from './pulseApi';

const CACHE_KEY = 'pulse.query-cache.v1';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: Storage,
  throttleTime: 1000
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE,
      refetchOnReconnect: true,
      retry: (failureCount, error) =>
        failureCount < 2 && (!(error instanceof PulseApiError) || error.retryable),
      staleTime: 60_000
    },
    mutations: {
      networkMode: 'always',
      retry: false
    }
  }
});

type Connectivity = { determined: boolean; online: boolean };
const ConnectivityContext = createContext<Connectivity>({ determined: false, online: false });

export function QueryProvider({ children }: { children: ReactNode }) {
  const [connectivity, setConnectivity] = useState<Connectivity>({
    determined: Platform.OS === 'web',
    online: Platform.OS === 'web'
  });

  useEffect(() => {
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setConnectivity({ determined: true, online });
      onlineManager.setOnline(online);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });

    return () => {
      unsubscribeNetwork();
      appStateSubscription.remove();
    };
  }, []);

  const value = useMemo(() => connectivity, [connectivity]);
  return (
    <ConnectivityContext.Provider value={value}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          buster: 'pulse-api-v1',
          maxAge: CACHE_MAX_AGE,
          persister,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
              query.state.status === 'success' && query.meta?.persist === true
          }
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

export function invalidateQuery(queryKey: QueryKey) {
  return queryClient.invalidateQueries({ queryKey });
}
