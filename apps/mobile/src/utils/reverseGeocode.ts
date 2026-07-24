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
  quarter?: string;
  city_district?: string;
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
    // Prefer the named locality (suburb/neighbourhood, ~300-500m — e.g.
    // "Rahatani", "Pimple Saudagar") over the specific road name: it's both
    // what users actually recognize as "their area" and more reliably
    // tagged in OSM than individual residential-lane names.
    streetArea:
      a.suburb || a.neighbourhood || a.quarter || a.city_district || a.road || "",
    city: a.city || a.town || a.village || a.municipality || "",
    district: a.state_district || a.county || "",
    state: a.state || "",
    pincode: a.postcode || "",
  };
}

// A device in a non-English locale (e.g. Marathi) returns native geocoder
// text in that locale's script — this is the original bug we moved away
// from native for. Only trust a native text field as an English cross-check
// if it contains no non-ASCII script characters (Devanagari, etc).
function isPlainAscii(text: string): boolean {
  return /^[\x00-\x7F]*$/.test(text);
}

interface NativeCrossCheck {
  pincode: string;
  streetArea: string;
}

async function fetchNativeCrossCheck(
  latitude: number,
  longitude: number
): Promise<NativeCrossCheck> {
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  const p = results[0];

  // Only trust a proper 6-digit Indian PIN — some locales format the field
  // differently, and a malformed value is worse than none.
  const pincode = p?.postalCode && /^\d{6}$/.test(p.postalCode) ? p.postalCode : "";

  // expo-location's `district` field is docs'd as "additional city-level
  // info" — on Android this is the geocoder's subLocality, i.e. the named
  // ~300-500m locality (Rahatani, Pimple Saudagar, Kalewadi...), which is
  // the granularity we want here — not `street`, which is a specific road.
  const streetCandidate = p?.district || p?.street || p?.name || "";
  const streetArea = streetCandidate && isPlainAscii(streetCandidate) ? streetCandidate : "";

  return { pincode, streetArea };
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
 * `streetArea` targets the named ~300-500m locality (e.g. "Rahatani",
 * "Pimple Saudagar", "Kalewadi") — what users actually recognize as "their
 * area" — not a specific road name. Both postcode AND locality-level
 * tagging are sparse/patchy in OpenStreetMap for India — Nominatim can
 * resolve city/district/state correctly (those come from well-mapped
 * administrative boundaries) while still returning a postcode from an
 * unrelated postal circle, or a suburb/road name that isn't actually where
 * the user is. The native platform geocoder (backed by Google's data on
 * Android) has much better Indian locality- and postal-level coverage, so
 * its postcode and sub-locality are preferred whenever they're available,
 * well-formed, and in English.
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
          streetArea: p.district || p.street || "",
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
    const native = await fetchNativeCrossCheck(latitude, longitude);
    if (native.pincode) result.pincode = native.pincode;
    if (native.streetArea) result.streetArea = native.streetArea;
  } catch {
    // keep whatever `result` already has from Nominatim
  }

  return result;
}
