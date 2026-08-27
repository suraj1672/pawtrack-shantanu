import { useEffect, useRef } from 'react';
import type { Dog, SensorReading } from '@/types';
import { insertVitalReading, createDogAlert, resolveDogAlerts, updateDog } from '@/lib/api';
import { readingFingerprint } from '@/lib/sensors';

const MIN_SAVE_INTERVAL_MS = 5_000; // persist at most every 5s per dog when values change
const FORCE_SAVE_INTERVAL_MS = 60_000; // also snapshot once a minute even if unchanged

/**
 * Saves every live pawtect reading into vital_readings with a current timestamp,
 * and updates dog alert / status flags from the live values.
 */
export function usePersistLiveVitals(options: {
  dogs: Dog[];
  ngoId: string | undefined;
  liveReadings: Record<string, SensorReading>;
  findReading: (deviceId: string, dogId?: string, dogName?: string) => SensorReading | null;
  onDogsUpdated?: (updater: (prev: Dog[]) => Dog[]) => void;
}) {
  const { dogs, ngoId, liveReadings, findReading, onDogsUpdated } = options;
  const lastFingerprint = useRef<Record<string, string>>({});
  const lastSavedAt = useRef<Record<string, number>>({});
  const dogsRef = useRef(dogs);
  dogsRef.current = dogs;

  useEffect(() => {
    if (!ngoId || !dogsRef.current.length) return;

    const persist = async () => {
      const now = Date.now();

      for (const dog of dogsRef.current) {
        const reading = findReading(dog.deviceId, dog.id, dog.name);
        if (!reading) continue;

        const fp = readingFingerprint(reading);
        const lastFp = lastFingerprint.current[dog.id];
        const lastAt = lastSavedAt.current[dog.id] || 0;
        const changed = fp !== lastFp;
        const dueForce = now - lastAt >= FORCE_SAVE_INTERVAL_MS;
        const dueMin = now - lastAt >= MIN_SAVE_INTERVAL_MS;

        if (!changed && !dueForce) continue;
        if (changed && !dueMin && lastAt > 0) continue;

        lastFingerprint.current[dog.id] = fp;
        lastSavedAt.current[dog.id] = now;

        const temperature = reading.bodyTempC;
        const heartRate = reading.bpm ?? 0;
        const recordedAt = new Date();

        try {
          await insertVitalReading({
            dogId: dog.id,
            deviceId: reading.deviceId || dog.deviceId,
            temperature,
            heartRate: reading.bpm,
            spo2: reading.spo2,
            activity: reading.activity || 'Resting',
            latitude: reading.lat,
            longitude: reading.lon,
            recordedAt,
          });

          // Alert rules from live pawtect values
          const temp = typeof temperature === 'number' ? temperature : 0;
          const lowTemp = temp > 0 && temp < 36;
          const highTemp = temp > 39.5;
          const highHr = heartRate > 140;
          const warnHr = heartRate > 130;
          const critical = highTemp || highHr;
          const warning = lowTemp || warnHr || (temp > 39.2 && temp <= 39.5);

          if (critical || warning) {
            const message = highTemp
              ? `High temperature detected - ${temp.toFixed(1)}°C`
              : lowTemp
                ? `Possible low body temperature - ${temp.toFixed(1)}°C`
                : highHr
                  ? `Elevated heart rate detected - ${heartRate} bpm`
                  : `Heart rate elevated - ${heartRate} bpm`;

            if (!dog.hasAlert || dog.alertMessage !== message) {
              await createDogAlert({
                dogId: dog.id,
                ngoId,
                severity: critical ? 'critical' : 'warning',
                message,
                vitalType: lowTemp || highTemp || temp > 39.2 ? 'temperature' : 'heart_rate',
                vitalValue: lowTemp || highTemp || temp > 39.2 ? temp : heartRate,
              });
              onDogsUpdated?.(prev =>
                prev.map(d =>
                  d.id === dog.id
                    ? {
                        ...d,
                        hasAlert: true,
                        alertMessage: message,
                        status: critical ? 'critical' : 'warning',
                        lastSeen: recordedAt,
                      }
                    : d
                )
              );
            }
          } else {
            if (dog.hasAlert) {
              await resolveDogAlerts(dog.id);
            }
            await updateDog(dog.id, {
              status: 'online',
              hasAlert: false,
              alertMessage: null,
              lastSeen: recordedAt.toISOString(),
            });
            onDogsUpdated?.(prev =>
              prev.map(d =>
                d.id === dog.id
                  ? {
                      ...d,
                      hasAlert: false,
                      alertMessage: null,
                      status: 'online',
                      lastSeen: recordedAt,
                    }
                  : d
              )
            );
          }
        } catch (err) {
          console.error('Failed to persist live vitals', err);
        }
      }
    };

    void persist();
  }, [liveReadings, ngoId, findReading, onDogsUpdated]);
}
