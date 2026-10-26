"use client";

import { useCallback, useState } from "react";

export type GeoErrorCode = "UNSUPPORTED" | "INSECURE" | "DENIED" | "UNAVAILABLE" | "TIMEOUT";

export interface GeoFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

export const GEO_MESSAGES: Record<GeoErrorCode, string> = {
  UNSUPPORTED: "This browser cannot share your location. You can search for your address instead.",
  INSECURE: "Location needs a secure (https) connection. You can search for your address instead.",
  DENIED: "Location access was blocked. You can allow it in your browser settings, or search for your address instead.",
  UNAVAILABLE: "We could not work out where you are. Please search for your address instead.",
  TIMEOUT: "Finding your location took too long. Please try again, or search for your address.",
};

/**
 * Ask the browser for the customer's position. Only called from a button press: browsers show their own
 * permission prompt, and we never read location silently.
 */
export function useGeolocation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GeoErrorCode | null>(null);

  const locate = useCallback((): Promise<GeoFix | null> => {
    setError(null);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("UNSUPPORTED");
      return Promise.resolve(null);
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError("INSECURE");
      return Promise.resolve(null);
    }
    setBusy(true);
    return new Promise<GeoFix | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBusy(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Math.round(pos.coords.accuracy) });
        },
        (err) => {
          setBusy(false);
          setError(err.code === err.PERMISSION_DENIED ? "DENIED" : err.code === err.TIMEOUT ? "TIMEOUT" : "UNAVAILABLE");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
      );
    });
  }, []);

  return { locate, busy, error, clearError: () => setError(null) };
}
