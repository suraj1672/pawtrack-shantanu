import { useCallback, useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '@/lib/firebase';
import { matchSensorReading, parsePawtectNode } from '@/lib/sensors';
import type { SensorReading } from '@/types';

/**
 * Live collar data from RTDB path:
 *   pawtect/{DOG_001} → heartRate, latitude, longitude, spO2, temperature
 */
export function useLiveSensors() {
  const [liveReadings, setLiveReadings] = useState<Record<string, SensorReading>>({});
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    const pawtectRef = ref(database, 'pawtect');
    const unsubscribe = onValue(
      pawtectRef,
      snapshot => {
        const value = snapshot.val();
        setLiveReadings(parsePawtectNode(value));
        setLiveLoading(false);
      },
      err => {
        console.error('Live collar connection failed', err);
        setLiveLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const findReading = useCallback(
    (deviceId: string, dogId?: string, dogName?: string) =>
      matchSensorReading(liveReadings, deviceId, dogId, dogName),
    [liveReadings]
  );

  const availableCollarIds = Array.from(
    new Set(
      Object.values(liveReadings)
        .map(r => r.dogKey || r.deviceId)
        .filter((id): id is string => Boolean(id))
    )
  ).sort();

  return {
    liveReadings,
    liveLoading,
    findReading,
    liveCount: availableCollarIds.length,
    availableCollarIds,
  };
}
