import { MapPin, Navigation, Search } from "lucide-react";
import type { MapMode } from "../types";
import { PLACE_TYPE_OPTIONS } from "../lib/places";

type Props = {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  origin: string;
  destination: string;
  placeType: string;
  onOriginChange: (v: string) => void;
  onDestinationChange: (v: string) => void;
  onPlaceTypeChange: (v: string) => void;
  onSubmitRoute: () => void;
  onSubmitNearby: () => void;
  loading: boolean;
  locationHint?: string | null;
};

const PRESETS = [
  { origin: "Ferry Building, San Francisco", destination: "Mission Dolores Park, San Francisco" },
  { origin: "Union Square, San Francisco", destination: "Golden Gate Park, San Francisco" },
];

export function RouteForm({
  mode,
  onModeChange,
  origin,
  destination,
  placeType,
  onOriginChange,
  onDestinationChange,
  onPlaceTypeChange,
  onSubmitRoute,
  onSubmitNearby,
  loading,
  locationHint,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 w-fit">
        <button
          type="button"
          onClick={() => onModeChange("route")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            mode === "route"
              ? "bg-emerald-600 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Safe route
        </button>
        <button
          type="button"
          onClick={() => onModeChange("nearby")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            mode === "nearby"
              ? "bg-emerald-600 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Find nearby
        </button>
      </div>

      {mode === "route" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitRoute();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-zinc-500 mb-1 block">Origin</span>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={origin}
                  onChange={(e) => onOriginChange(e.target.value)}
                  placeholder="Where are you?"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500 mb-1 block">Destination</span>
              <div className="relative">
                <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={destination}
                  onChange={(e) => onDestinationChange(e.target.value)}
                  placeholder="Where to?"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={loading || !origin.trim() || !destination.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {loading ? "Planning…" : "Find safe route"}
            </button>
            {PRESETS.map((p) => (
              <button
                key={p.origin}
                type="button"
                onClick={() => {
                  onOriginChange(p.origin);
                  onDestinationChange(p.destination);
                }}
                className="px-2 py-1 rounded-lg text-[11px] border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-300"
              >
                Demo
              </button>
            ))}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <MapPin size={12} />
            {locationHint ?? "Tries your location, falls back to SF center in ~4s"}
          </p>
          <div className="flex flex-wrap gap-2">
            {PLACE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onPlaceTypeChange(opt.key)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  placeType === opt.key
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-500"
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onSubmitNearby}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loading ? "Searching…" : `Find safe ${placeType}`}
          </button>
        </div>
      )}
    </div>
  );
}
