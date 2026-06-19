import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import type { NavigationCue } from "../types";
import { GUARDIAN_API_URL } from "../lib/config";

const API_BASE = import.meta.env.VITE_API_URL ?? GUARDIAN_API_URL;

const SEGMENT_LABEL: Record<string, string> = {
  departure: "Start",
  along_route: "Mid-route",
  approach_destination: "Approaching destination",
};

type Props = {
  cues: NavigationCue[];
};

export function StreetViewPanel({ cues }: Props) {
  const [index, setIndex] = useState(0);
  const cue = cues[index];

  useEffect(() => {
    setIndex(0);
  }, [cues]);

  if (!cues.length || !cue) return null;

  const imageUrl =
    cue.streetViewAvailable && cue.lat != null
      ? `${API_BASE}/maps/streetview/image?lat=${cue.lat}&lng=${cue.lng}&heading=${cue.heading}`
      : null;

  const label = SEGMENT_LABEL[cue.segment] ?? cue.segment;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-emerald-400" />
          <h3 className="text-sm font-semibold">Street View · Nebius vision</h3>
        </div>
        {cues.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="p-1 rounded border border-zinc-700 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] text-zinc-500">
              {index + 1}/{cues.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(cues.length - 1, i + 1))}
              disabled={index === cues.length - 1}
              className="p-1 rounded border border-zinc-700 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      <p className="px-4 pt-2 text-xs text-zinc-500">{label} · heading {cue.heading}°</p>
      <div className="aspect-[16/10] bg-zinc-900 flex items-center justify-center mx-4 mt-2 rounded-lg overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={`Street View ${label}`} className="w-full h-full object-cover" />
        ) : (
          <p className="text-sm text-zinc-500 px-4 text-center">No Street View imagery here — description uses location context only.</p>
        )}
      </div>
      <p className="p-4 text-sm text-zinc-300 leading-relaxed">{cue.description}</p>
    </div>
  );
}
