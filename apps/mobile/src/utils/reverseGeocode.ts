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

/**
 * Reverse-geocode coordinates to an English address.
 *
 * expo-location's `reverseGeocodeAsync` returns results in the *device*
 * locale (Marathi on a Marathi device) and has no language parameter — so we
 * hit OpenStreetMap Nominatim with `accept-language=en` for guaranteed English.
 * If that request fails (offline, rate-limited), we fall back to the native
 * geocoder so the fields still populate (device-locale beats nothing).
 */
export async function reverseGeocodeEnglish(
  latitude: number,
  longitude: number
): Promise<GeoAddress | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}` +
      `&lon=${longitude}&format=jsonv2&accept-language=en`;
    const res = await fetch(url, {
      headers: {
        // Nominatim usage policy requires an identifying User-Agent.
        "User-Agent": "DigiabilityCommunity/1.0 (support@digiability.app)",
      },
    });
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
  } catch {
    // Fallback: native geocoder (device locale, but better than empty).
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length === 0) return null;
      const p = results[0];
      return {
        streetArea: p.street || "",
        city: p.city || "",
        district: p.subregion || "",
        state: p.region || "",
        pincode: p.postalCode || "",
      };
    } catch {
      return null;
    }
  }
}
