import { Navigation, Search } from "lucide-react";

type Props = {
  origin: string;
  destination: string;
  onOriginChange: (v: string) => void;
  onDestinationChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

const PRESETS = [
  { origin: "Ferry Building, San Francisco", destination: "Mission Dolores Park, San Francisco" },
  { origin: "Union Square, San Francisco", destination: "Golden Gate Park, San Francisco" },
];

export function RouteForm({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  onSubmit,
  loading,
}: Props) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
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
  );
}
