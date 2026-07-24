import * as Location from "expo-location";

export interface GeoAddress {
  streetArea: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state_district?: string;
  county?: string;
  state?: string;
  postcode?: string;
}

async function fetchNominatimAddress(
  latitude: number,
  longitude: number
): Promise<GeoAddress | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}` +
    `&lon=${longitude}&format=jsonv2&accept-language=en`;
  // Abort after 8s — RN fetch has no default timeout, and a stalled
  // request here would leave the "Use Current Location" flow hanging.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      // Nominatim usage policy requires an identifying User-Agent.
      "User-Agent": "DigiabilityCommunity/1.0 (support@digiability.app)",
    },
  }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = (await res.json()) as { address?: NominatimAddress };
  const a = json.address;
  if (!a) throw new Error("No address in response");

  return {
    streetArea: a.road || a.neighbourhood || a.suburb || "",
    city: a.city || a.town || a.village || a.municipality || "",
    district: a.state_district || a.county || "",
    state: a.state || "",
    pincode: a.postcode || "",
  };
}

async function fetchNativePostalCode(
  latitude: number,
  longitude: number
): Promise<string> {
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  const code = results[0]?.postalCode || "";
  // Only trust a proper 6-digit Indian PIN — some locales can format the
  // field differently, and a malformed value is worse than none.
  return /^\d{6}$/.test(code) ? code : "";
}

/**
 * Reverse-geocode coordinates to an English address.
 *
 * expo-location's `reverseGeocodeAsync` returns results in the *device*
 * locale (Marathi on a Marathi device) and has no language parameter — so we
 * hit OpenStreetMap Nominatim with `accept-language=en` for guaranteed English.
 * If that request fails (offline, rate-limited), we fall back to the native
 * geocoder so the fields still populate (device-locale beats nothing).
 *
 * Postcode tagging in OpenStreetMap is sparse in India — Nominatim can fall
 * back to the nearest tagged node and return a PIN from a completely
 * different postal circle even when road/city/district/state are all
 * correctly resolved. The native platform geocoder (backed by Google's data
 * on Android) has much better Indian postal-code coverage, so its postcode
 * is preferred whenever it's available and well-formed.
 */
export async function reverseGeocodeEnglish(
  latitude: number,
  longitude: number
): Promise<GeoAddress | null> {
  let result: GeoAddress | null = null;
  try {
    result = await fetchNominatimAddress(latitude, longitude);
  } catch {
    // Fallback: native geocoder (device locale, but better than nothing).
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const p = results[0];
      if (p) {
        result = {
          streetArea: p.street || "",
          city: p.city || "",
          district: p.subregion || "",
          state: p.region || "",
          pincode: p.postalCode || "",
        };
      }
    } catch {
      result = null;
    }
  }

  if (!result) return null;

  try {
    const nativePincode = await fetchNativePostalCode(latitude, longitude);
    if (nativePincode) result.pincode = nativePincode;
  } catch {
    // keep whatever pincode `result` already has
  }

  return result;
}
