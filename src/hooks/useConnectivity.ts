import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export function useConnectivity() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      if (mounted) setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    };

    check();
    const id = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return online;
}
