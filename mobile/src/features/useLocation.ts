import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export type LocationStatus = 'idle' | 'locating' | 'denied' | 'error';

export function useDeviceLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');

  const locate = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('denied');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setStatus('idle');
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      setStatus('error');
      return null;
    }
  }, []);

  return { status, locate };
}
