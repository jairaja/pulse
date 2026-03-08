import { useEffect } from 'react';
import * as Network from 'expo-network';
import { useAppStore } from '@/app/store/useAppStore';

export function useConnectivityMonitor() {
  const setOnline = useAppStore((state) => state.setOnline);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const state = await Network.getNetworkStateAsync();
      if (active) {
        setOnline(Boolean(state.isConnected && state.isInternetReachable));
      }
    };

    run();
    const timer = setInterval(run, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [setOnline]);
}
