export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const rad = Math.PI / 180
  const phi1 = lat1 * rad
  const phi2 = lat2 * rad
  const deltaPhi = (lat2 - lat1) * rad
  const deltaLambda = (lon2 - lon1) * rad
  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function assertWithinGeofence(
  lat: number,
  lng: number,
  anchorLat: number,
  anchorLng: number,
  radiusM: number,
): { ok: true } | { ok: false; distanceM: number } {
  const distanceM = getDistanceInMeters(lat, lng, anchorLat, anchorLng)
  if (distanceM > radiusM) return { ok: false, distanceM }
  return { ok: true }
}
