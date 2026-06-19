import { Clock, MapPin, Star } from "lucide-react";
import type { NearbyPlace } from "../types";
import { formatDistance } from "../lib/utils";
import { placeIcon } from "../lib/places";

type Props = {
  places: NearbyPlace[];
  selectedPlaceId: string | null;
  onSelect: (id: string) => void;
  voiceSummary: string | null;
  loading: boolean;
  error: string | null;
};

export function PlacesPanel({
  places,
  selectedPlaceId,
  onSelect,
  voiceSummary,
  loading,
  error,
}: Props) {
  const selected = places.find((p) => p.id === selectedPlaceId) ?? places[0];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Nearby places
        </h2>
        <p className="text-xs text-zinc-500 mt-1">Sorted safest-first · walking routes scored</p>
      </div>

      {loading && (
        <div className="text-sm text-zinc-500 animate-pulse py-8 text-center">Finding safe places…</div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
      )}

      {voiceSummary && !loading && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {voiceSummary}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {places.map((place, i) => {
          const active = place.id === (selectedPlaceId ?? places[0]?.id);
          const icon = placeIcon(place.types);
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onSelect(place.id)}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/10"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] hover:border-zinc-400"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {place.name}
                    {i === 0 && (
                      <span className="ml-1.5 text-[10px] uppercase text-emerald-500 font-semibold">
                        safest
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{place.address}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {formatDistance(place.route.distanceMeters)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {place.route.durationText}
                    </span>
                    {place.rating != null && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Star size={11} fill="currentColor" /> {place.rating}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-emerald-400">{place.route.safetyScore}</p>
                  <p className="text-[10px] text-zinc-500">risk {place.riskScore}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-3 text-sm text-zinc-400">
          Walking route: {selected.route.durationText} · safety {selected.route.safetyScore}/100
        </div>
      )}
    </div>
  );
}
