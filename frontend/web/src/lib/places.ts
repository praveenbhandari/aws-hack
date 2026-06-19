export const PLACE_TYPE_OPTIONS = [
  { key: "restaurant", label: "Restaurant", icon: "🍽️" },
  { key: "cafe", label: "Cafe", icon: "☕" },
  { key: "bart", label: "BART", icon: "🚇" },
  { key: "pharmacy", label: "Pharmacy", icon: "💊" },
  { key: "hospital", label: "Hospital", icon: "🏥" },
  { key: "hotel", label: "Hotel", icon: "🏨" },
] as const;

export const PLACE_ICONS: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  food: "🍽️",
  subway_station: "🚇",
  train_station: "🚂",
  transit_station: "🚇",
  hospital: "🏥",
  pharmacy: "💊",
  lodging: "🏨",
  default: "📍",
};

export function placeIcon(types: string[]): string {
  for (const t of types) {
    if (PLACE_ICONS[t]) return PLACE_ICONS[t];
  }
  return PLACE_ICONS.default;
}
