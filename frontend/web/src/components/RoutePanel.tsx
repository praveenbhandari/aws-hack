import { Clock, MapPin, Shield, ShieldAlert } from "lucide-react";
import type { RouteCandidate, RoutePreference } from "../types";
import { formatDistance, formatDuration, riskColor, riskLabel } from "../lib/utils";

type Props = {
  routes: RouteCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
  preference: RoutePreference;
  onPreferenceChange: (p: RoutePreference) => void;
  showPrompt: boolean;
  onConfirmPreference: (avoid: boolean) => void;
};

const PREFERENCE_HINT: Record<RoutePreference, string> = {
  safest: "Highest safety score · detours around crime heatmap",
  compare: "Tap any route below to select by safety score",
  fastest: "Shortest distance · may cross higher-risk areas",
};

export function RoutePanel({
  routes,
  selectedId,
  onSelect,
  loading,
  error,
  preference,
  onPreferenceChange,
  showPrompt,
  onConfirmPreference,
}: Props) {
  const selected = routes.find((r) => r.id === selectedId) ?? routes[0];
  const safestScore = routes[0]?.safetyScore;
  const fastestRoute = routes.length
    ? [...routes].sort((a, b) => a.distanceMeters - b.distanceMeters)[0]
    : null;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Route options
        </h2>
        <p className="text-xs text-zinc-500 mt-1">{PREFERENCE_HINT[preference]}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["safest", "Safest"],
            ["compare", "Compare"],
            ["fastest", "Fastest"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onPreferenceChange(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              preference === key
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showPrompt && routes.length >= 2 && safestScore != null && fastestRoute && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-200 mb-2">Routes differ in safety.</p>
          <p className="text-zinc-400 text-xs mb-3">
            Safest: {safestScore}/100. Fastest path: {fastestRoute.safetyScore}/100 (
            {formatDistance(fastestRoute.distanceMeters)}).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onConfirmPreference(true)}
              className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
            >
              Use safest
            </button>
            <button
              type="button"
              onClick={() => onConfirmPreference(false)}
              className="flex-1 py-2 rounded-lg border border-zinc-600 text-zinc-300 text-xs font-semibold"
            >
              Use fastest
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-sm text-zinc-500 animate-pulse py-4 text-center">Finding safe routes…</div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="flex-1 min-h-[120px] overflow-y-auto space-y-2 pr-1">
        {routes.map((route, i) => {
          const active = route.id === (selectedId ?? routes[0]?.id);
          const isSafest = i === 0;
          const isFastest =
            fastestRoute?.id === route.id && routes.length > 1 && !isSafest;
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelect(route.id)}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] hover:border-zinc-400"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {route.summary || `Route ${i + 1}`}
                    {isSafest && (
                      <span className="ml-1.5 text-[10px] uppercase text-emerald-500 font-semibold">
                        safest
                      </span>
                    )}
                    {isFastest && (
                      <span className="ml-1.5 text-[10px] uppercase text-sky-400 font-semibold">
                        fastest
                      </span>
                    )}
                    {route.reroutedAroundHeatmap && (
                      <span className="ml-1.5 text-[10px] uppercase text-amber-400 font-semibold">
                        detour
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {formatDistance(route.distanceMeters)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {formatDuration(route.durationSeconds)}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-lg font-semibold" style={{ color: riskColor(route.riskLevel) }}>
                    {route.safetyScore}
                  </p>
                  <p className="text-[10px] uppercase text-zinc-500">{riskLabel(route.riskLevel)}</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${route.safetyScore}%`, backgroundColor: riskColor(route.riskLevel) }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-3 text-sm shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <Shield size={16} />
              <span className="font-medium">Safety brief</span>
            </div>
            <span className="text-xs font-mono text-zinc-500">{selected.safetyScore}/100</span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-xs">{selected.explanation}</p>
          {selected.navigationSummary && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <p className="flex items-center gap-1 text-xs text-emerald-500 mb-1 font-medium">
                <Shield size={12} /> Ahead on your route
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">{selected.navigationSummary}</p>
            </div>
          )}
          {selected.avoidedHotspots.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <p className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                <ShieldAlert size={12} /> Avoided hotspots
              </p>
              <ul className="text-xs text-zinc-400 space-y-0.5">
                {selected.avoidedHotspots.slice(0, 3).map((h) => (
                  <li key={h.id}>
                    {h.category} · severity {h.severity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
