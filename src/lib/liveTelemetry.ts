import type { SensorReading } from '@/types';

export const LIVE_READING_STALE_MS = 30_000;

function toMillis(value: SensorReading['timestamp']): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function readingTimestampMs(reading: SensorReading | null | undefined): number | null {
  return reading ? toMillis(reading.timestamp) : null;
}

export function isReadingFresh(reading: SensorReading | null | undefined, now = Date.now()) {
  const timestampMs = readingTimestampMs(reading);
  if (timestampMs == null) return false;
  return now - timestampMs <= LIVE_READING_STALE_MS;
}
