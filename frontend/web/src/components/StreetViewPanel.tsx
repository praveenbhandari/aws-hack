import { useEffect, useState } from "react";
import type { LatLng } from "../types";
import { fetchStreetView } from "../api/client";

type Props = {
  point: LatLng | null;
  label?: string;
};

export function StreetViewPanel({ point, label = "Destination" }: Props) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!point) {
      setAvailable(false);
      setImageUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStreetView(point.lat, point.lng)
      .then((data) => {
        if (cancelled) return;
        setAvailable(data.available);
        if (data.available && data.imageUrl) {
          const base = import.meta.env.VITE_API_URL ?? "/api";
          setImageUrl(`${base}${data.imageUrl}`);
        } else {
          setImageUrl(null);
          setError("No Street View coverage at this spot");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setAvailable(false);
        setImageUrl(null);
        setError(e instanceof Error ? e.message : "Street View unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [point?.lat, point?.lng]);

  if (!point) return null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Street View — {label}</h3>
        <span className="text-xs text-zinc-500">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </span>
      </div>
      <div className="aspect-[16/10] bg-zinc-900 flex items-center justify-center">
        {loading && <p className="text-sm text-zinc-500">Loading Street View…</p>}
        {!loading && imageUrl && (
          <img src={imageUrl} alt={`Street View at ${label}`} className="w-full h-full object-cover" />
        )}
        {!loading && !imageUrl && (
          <p className="text-sm text-zinc-500 px-4 text-center">
            {error ?? (available ? "Preview unavailable" : "Set GOOGLE_MAPS_API_KEY for Street View")}
          </p>
        )}
      </div>
    </div>
  );
}
