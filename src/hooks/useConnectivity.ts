import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useState } from 'react';

export const useConnectivity = () => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(Boolean(state.isConnected));
    });

    return unsubscribe;
  }, []);

  return { isConnected };
};
