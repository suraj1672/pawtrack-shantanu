import type { SensorReading } from '@/types';

type Json = Record<string, unknown>;

function num(...values: unknown[]): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}

function isObject(v: unknown): v is Json {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Primary live path (highlighted in RTDB console):
 *   pawtect / DOG_001 / { heartRate, latitude, longitude, spO2, temperature }
 */
export function parsePawtectNode(pawtect: unknown): Record<string, SensorReading> {
  const map: Record<string, SensorReading> = {};
  if (!isObject(pawtect)) return map;

  Object.entries(pawtect).forEach(([dogKey, node]) => {
    // Skip nested containers like pawtect/dogs/...
    if (dogKey === 'dogs' || !isObject(node)) return;
    if (isObject(node.live) || isObject(node.history) || isObject(node.health)) return;

    // Must look like the flat vitals payload
    if (
      node.temperature == null &&
      node.heartRate == null &&
      node.latitude == null &&
      node.longitude == null &&
      node.spO2 == null &&
      node.spo2 == null
    ) {
      return;
    }

    const temperature = num(node.temperature, node.bodyTempC, node.temperatureC);
    const bpm = num(node.heartRate, node.bpm, node.heartRateBPM);
    const lat = num(node.latitude, node.lat);
    const lon = num(node.longitude, node.lon);
    const spo2 = num(node.spO2, node.spo2);
    const now = Date.now();

    const reading: SensorReading = {
      deviceId: dogKey,
      dogKey,
      bodyTempC: temperature,
      bpm,
      lat,
      lon,
      spo2,
      activity:
        lat || lon
          ? (num(node.speedKmph) ?? 0) > 0.5
            ? 'Moving'
            : 'Resting'
          : 'Resting',
      timestamp: now,
      sourcePath: `pawtect/${dogKey}`,
    };

    // Index by dog key (DOG_001) — this is what users set as device_id
    map[dogKey] = reading;
    map[dogKey.toUpperCase()] = reading;
    map[dogKey.toLowerCase()] = reading;
  });

  return map;
}

/** Stable fingerprint so we only persist when values actually change */
export function readingFingerprint(r: SensorReading): string {
  return [
    r.deviceId || r.dogKey || '',
    r.bodyTempC ?? '',
    r.bpm ?? '',
    r.lat ?? '',
    r.lon ?? '',
    r.spo2 ?? '',
  ].join('|');
}

export function matchSensorReading(
  readings: Record<string, SensorReading>,
  deviceId: string,
  dogId?: string,
  dogName?: string
): SensorReading | null {
  const candidates = [deviceId, dogId, dogName]
    .filter(Boolean)
    .flatMap(c => [String(c), String(c).toUpperCase(), String(c).toLowerCase()]);

  for (const key of candidates) {
    if (readings[key]) return readings[key];
  }

  const normalized = candidates.map(c => c.toLowerCase());
  return (
    Object.values(readings).find(r => {
      const aliases = [r.deviceId, r.dogKey, r.dogName]
        .filter(Boolean)
        .map(a => String(a).toLowerCase());
      return aliases.some(a => normalized.includes(a));
    }) ?? null
  );
}
