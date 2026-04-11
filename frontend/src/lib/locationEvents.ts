export const LOCATION_UPDATED_EVENT = "farmease:location-updated";

export function emitLocationUpdatedToast(message = "Insights updated for your new location") {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(LOCATION_UPDATED_EVENT, {
      detail: { message },
    }),
  );
}
