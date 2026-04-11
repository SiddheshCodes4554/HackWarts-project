export type StructuredLocation = {
  lat: number;
  lon: number;
  village: string;
  district: string;
  state: string;
  country: string;
  full_address: string;
};

type NominatimReverseResponse = {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    district?: string;
    state_district?: string;
    state?: string;
    country?: string;
  };
};

const DEFAULT_LOCATION: StructuredLocation = {
  lat: 21.1458,
  lon: 79.0882,
  village: "Nagpur",
  district: "Nagpur",
  state: "Maharashtra",
  country: "India",
  full_address: "Nagpur, Maharashtra, India",
};

export async function reverseGeocodeStructured(lat: number, lon: number): Promise<StructuredLocation> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Reverse geocode failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as NominatimReverseResponse;

    const village = data.address?.village ?? data.address?.town ?? data.address?.city ?? "";
    const district = data.address?.district ?? data.address?.state_district ?? data.address?.county ?? "";
    const state = data.address?.state ?? "";
    const country = data.address?.country ?? "India";
    const full_address = data.display_name ?? [village, district, state, country].filter(Boolean).join(", ");

    return {
      lat,
      lon,
      village,
      district,
      state,
      country,
      full_address,
    };
  } catch {
    return {
      ...DEFAULT_LOCATION,
      lat,
      lon,
    };
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const location = await reverseGeocodeStructured(lat, lon);
  return location.full_address || `${location.village || location.district}, ${location.state || location.country}`;
}
