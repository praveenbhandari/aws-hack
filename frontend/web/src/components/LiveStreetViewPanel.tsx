import { Eye, MapPin, Pause, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiErrorMessage,
  fetchStreetViewDescribe,
  getGeoPermission,
  getUserLocation,
  SF_CENTER,
  type StreetViewDescribe,
} from "../api/client";
import type { LatLng } from "../types";
import { GUARDIAN_API_URL } from "../lib/config";

const API_BASE = import.meta.env.VITE_API_URL ?? GUARDIAN_API_URL;
const REFRESH_MS = 20_000;

type Props = {
  destinationLabel?: string;
  onLocation?: (pos: LatLng) => void;
};

export function LiveStreetViewPanel({ destinationLabel, onLocation }: Props) {
  const [active, setActive] = useState(true);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState(0);
  const [geoPermission, setGeoPermission] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [fromGps, setFromGps] = useState(false);
  const [snapshot, setSnapshot] = useState<StreetViewDescribe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const positionRef = useRef<LatLng | null>(null);
  const headingRef = useRef(0);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    void getGeoPermission().then(setGeoPermission);
  }, [fromGps]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const fallback = positionRef.current ?? SF_CENTER;
      const loc = await getUserLocation(fallback);
      const pos = { lat: loc.lat, lng: loc.lng };
      setPosition(pos);
      setFromGps(loc.fromGps);
      onLocation?.(pos);
      if (loc.fromGps) setGeoPermission("granted");

      const h = headingRef.current;
      const data = await fetchStreetViewDescribe(
        pos.lat,
        pos.lng,
        h,
        "along_route",
        "your location",
        destinationLabel,
      );
      setSnapshot(data);
      setUpdatedAt(new Date());
      setSecondsLeft(REFRESH_MS / 1000);
    } catch (e) {
      setError(apiErrorMessage(e, "Street View describe failed"));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [destinationLabel, onLocation]);

  const requestLocation = useCallback(async () => {
    const loc = await getUserLocation(position ?? SF_CENTER);
    const pos = { lat: loc.lat, lng: loc.lng };
    setPosition(pos);
    setFromGps(loc.fromGps);
    positionRef.current = pos;
    onLocation?.(pos);
    setGeoPermission(loc.fromGps ? "granted" : await getGeoPermission());
    if (loc.fromGps) void refresh();
  }, [onLocation, position, refresh]);

  // Geolocation watch while active
  useEffect(() => {
    if (!active || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(next);
        setFromGps(true);
        positionRef.current = next;
        onLocation?.(next);
        if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
          headingRef.current = pos.coords.heading;
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoPermission("denied");
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, onLocation]);

  // Device compass heading (mobile)
  useEffect(() => {
    if (!active) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      const ios = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const h = ios.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      if (h != null && !Number.isNaN(h)) {
        setHeading(h);
        headingRef.current = h;
      }
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [active]);

  // 20s refresh loop
  useEffect(() => {
    if (!active) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [active, refresh]);

  // Countdown display
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? REFRESH_MS / 1000 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [active, updatedAt]);

  const imageUrl =
    snapshot?.streetViewAvailable && snapshot.imageUrl
      ? `${API_BASE}${snapshot.imageUrl}`
      : snapshot?.lat != null
        ? `${API_BASE}/maps/streetview/image?lat=${snapshot.lat}&lng=${snapshot.lng}&heading=${snapshot.heading}`
        : null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden shrink-0">
      <div className="px-3 py-2.5 border-b border-emerald-500/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={16} className="text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Live Street View</p>
            <p className="text-[10px] text-zinc-500 flex items-center gap-1">
              <MapPin size={10} />
              {fromGps ? "Your GPS" : "Demo / last known"} · every 20s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-40"
            title="Refresh now"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white"
            title={active ? "Pause" : "Resume"}
          >
            {active ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
      </div>

      {!active && (
        <p className="p-3 text-xs text-zinc-500">Paused — press play to resume live descriptions.</p>
      )}

      {active && !fromGps && (
        <div className="p-3 border-b border-emerald-500/10 space-y-2">
          <p className="text-xs text-amber-200/90">
            {geoPermission === "denied"
              ? "Location blocked — enable it in browser settings (Safari: Settings → Privacy → Location)."
              : "Allow location so Street View and Nebius describe where you are, not downtown SF."}
          </p>
          <button
            type="button"
            onClick={() => void requestLocation()}
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
          >
            Use my current location
          </button>
        </div>
      )}

      {active && (
        <>
          <div className="aspect-[16/10] bg-zinc-900 relative">
            {imageUrl ? (
              <img
                key={imageUrl}
                src={imageUrl}
                alt="Street View at your location"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-zinc-500">
                {loading ? "Loading Street View…" : "No panorama here — Nebius still describes the area from crime data."}
              </div>
            )}
            {loading && imageUrl && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-emerald-400" />
              </div>
            )}
          </div>

          <div className="p-3 space-y-2">
            {position && (
              <p className="text-[10px] text-zinc-500 font-mono">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · heading {Math.round(heading)}°
                {updatedAt && ` · next in ${secondsLeft}s`}
              </p>
            )}
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <p className="text-sm text-zinc-200 leading-relaxed min-h-[3rem]">
              {snapshot?.description ?? (loading ? "Analyzing view with Nebius vision…" : "Waiting for first update…")}
            </p>
            <p className="text-[10px] text-emerald-500/80 uppercase tracking-wide font-medium">
              Nebius vision · crime-aware
            </p>
          </div>
        </>
      )}
    </div>
  );
}
