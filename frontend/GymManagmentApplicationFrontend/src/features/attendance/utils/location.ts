import * as Location from 'expo-location';

export interface Coords { lat: number; lng: number; accuracyM?: number }

/**
 * Reads the device's current GPS position (asks for permission first). Works on iOS,
 * Android and the web (browser geolocation). No Google Maps or API key involved.
 */
export async function getCurrentCoords(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted')
    throw new Error('Location permission was denied. Allow location access for this app in your settings and try again.');

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracyM: pos.coords.accuracy ?? undefined,
  };
}

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Pulls latitude/longitude out of whatever was copied from Google Maps:
 *  - plain coordinates: "9.9312, 76.2673" or "9.9312 76.2673"
 *  - place / share URLs: ".../@9.9312,76.2673,17z", "...?q=9.9312,76.2673", "...&ll=…",
 *    "...query=…", "...!3d9.9312!4d76.2673"
 * Returns null when nothing usable is found (e.g. a shortened maps.app.goo.gl link, which
 * hides the coordinates until opened).
 */
export function parseCoordinates(input: string): Coords | null {
  const text = decodeURIComponent(input.trim());
  if (!text) return null;
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';

  const patterns = [
    new RegExp(`!3d${num}!4d${num}`),                 // data=!3dLAT!4dLNG (exact pin)
    new RegExp(`@${num},\\s*${num}`),                  // /@LAT,LNG,zoom
    new RegExp(`[?&](?:q|ll|query|destination|center)=${num},\\s*${num}`),
    new RegExp(`^${num}\\s*[,\\s]\\s*${num}$`),        // plain "LAT, LNG"
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export const isShortMapsLink = (input: string) => /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(input);

export const formatCoords = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

export const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
