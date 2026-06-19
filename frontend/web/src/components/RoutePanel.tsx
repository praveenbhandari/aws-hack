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

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Route options
        </h2>
        <p className="text-xs text-zinc-500 mt-1">Sorted safest-first · crime heatmap overlay</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["ask", "Compare"],
            ["avoid", "Avoid risk"],
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

      {showPrompt && routes.length >= 2 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-200 mb-2">High-risk areas detected on the fastest path.</p>
          <p className="text-zinc-400 text-xs mb-3">
            Safest: {routes[0].safetyScore}/100 ({formatDistance(routes[0].distanceMeters)}). Shortest:{" "}
            {routes[routes.length - 1].safetyScore}/100 ({formatDistance(routes[routes.length - 1].distanceMeters)}).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onConfirmPreference(true)}
              className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
            >
              Avoid risky areas
            </button>
            <button
              type="button"
              onClick={() => onConfirmPreference(false)}
              className="flex-1 py-2 rounded-lg border border-zinc-600 text-zinc-300 text-xs font-semibold"
            >
              Take fastest
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-sm text-zinc-500 animate-pulse py-8 text-center">Finding safe routes…</div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {routes.map((route, i) => {
          const active = route.id === (selectedId ?? routes[0]?.id);
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelect(route.id)}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/10"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] hover:border-zinc-400"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">
                    {route.summary || `Route ${i + 1}`}
                    {route.reroutedAroundHeatmap && (
                      <span className="ml-1.5 text-[10px] uppercase text-emerald-500 font-semibold">
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
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-3 text-sm">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Shield size={16} />
            <span className="font-medium">Safety brief</span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">{selected.explanation}</p>
          {selected.navigationSummary && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <p className="flex items-center gap-1 text-xs text-emerald-500 mb-1 font-medium">
                <Shield size={12} /> Ahead on your route
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">{selected.navigationSummary}</p>
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
