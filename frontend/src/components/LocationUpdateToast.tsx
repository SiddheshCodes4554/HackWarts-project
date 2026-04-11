"use client";

import { useEffect, useState } from "react";
import { LOCATION_UPDATED_EVENT } from "@/lib/locationEvents";

type LocationToastDetail = {
  message?: string;
};

const DEFAULT_MESSAGE = "Insights updated for your new location";

export function LocationUpdateToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<LocationToastDetail>;
      setMessage(customEvent.detail?.message ?? DEFAULT_MESSAGE);
      setVisible(true);

      const timerId = window.setTimeout(() => {
        setVisible(false);
      }, 2800);

      return () => {
        window.clearTimeout(timerId);
      };
    };

    window.addEventListener(LOCATION_UPDATED_EVENT, handler as EventListener);

    return () => {
      window.removeEventListener(LOCATION_UPDATED_EVENT, handler as EventListener);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[90] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg">
      {message}
    </div>
  );
}
