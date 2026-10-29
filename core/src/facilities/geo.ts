import type { GeoPoint } from "./types.js";

function assertValid(p: GeoPoint): void {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) {
    throw new RangeError("Invalid coordinates.");
  }
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  assertValid(a);
  assertValid(b);
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rounds a position to one decimal place (about 11 km). Call this on the device
 * or at the edge BEFORE a location is stored or sent anywhere: a recommendation
 * needs "roughly where", not "which house".
 */
export function coarsenLocation(p: GeoPoint): GeoPoint {
  assertValid(p);
  return { lat: Math.round(p.lat * 10) / 10, lon: Math.round(p.lon * 10) / 10 };
}
