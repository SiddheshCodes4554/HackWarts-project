export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      {
        headers: {
          "User-Agent": "AgriWizard App",
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Reverse geocode failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
      };
    };

    const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? "Unknown";
    const state = data.address?.state ?? "India";

    return `${city}, ${state}`;
  } catch {
    return "Nagpur, Maharashtra";
  }
}
