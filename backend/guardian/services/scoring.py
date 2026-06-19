from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Literal, TypedDict

RiskLevel = Literal["low", "moderate", "high", "very_high"]


class LatLng(TypedDict):
    lat: float
    lng: float


class Hotspot(TypedDict, total=False):
    id: str
    lat: float
    lng: float
    category: str
    severity: int
    occurredAt: str
    source: str
    weight: float


class RawHotspot(TypedDict, total=False):
    id: str
    lat: float
    lng: float
    category: str
    severity: int
    occurredAt: str
    source: str


CATEGORY_SEVERITY: dict[str, int] = {
    "HOMICIDE": 5,
    "KIDNAPPING": 5,
    "SEX OFFENSES": 5,
    "SEX OFFENSE": 5,
    "HUMAN TRAFFICKING": 5,
    "ROBBERY": 5,
    "ASSAULT": 4,
    "ARSON": 4,
    "WEAPON LAWS": 4,
    "WEAPONS CARRYING ETC": 4,
    "EXTORTION": 4,
    "BURGLARY": 3,
    "VEHICLE THEFT": 3,
    "MOTOR VEHICLE THEFT": 3,
    "RECOVERED VEHICLE": 2,
    "LARCENY/THEFT": 3,
    "LARCENY THEFT": 3,
    "VANDALISM": 2,
    "MALICIOUS MISCHIEF": 2,
    "TRESPASS": 2,
    "DISORDERLY CONDUCT": 2,
    "DRUG OFFENSE": 2,
    "DRUG VIOLATION": 2,
    "FRAUD": 2,
    "OTHER OFFENSES": 2,
    "OTHER MISCELLANEOUS": 2,
    "SUSPICIOUS": 2,
    "PROSTITUTION": 2,
    "LOST PROPERTY": 1,
    "MISSING PERSON": 1,
    "MISCELLANEOUS INVESTIGATION": 1,
    "NON-CRIMINAL": 1,
    "WARRANTS": 1,
    "TRAFFIC CITATION": 1,
    "TRAFFIC VIOLATION ARREST": 1,
}

MAX_AREA_RISK = 15
MAX_ROUTE_EXPOSURE = 25


def normalize_category(category: str) -> str:
    return re.sub(r"\s+", " ", category.upper().strip())


def category_to_severity(category: str) -> int:
    return CATEGORY_SEVERITY.get(normalize_category(category), 2)


def recency_decay(occurred_at: str, now_ms: float | None = None) -> float:
    if now_ms is None:
        now_ms = datetime.now(timezone.utc).timestamp() * 1000
    try:
        then = datetime.fromisoformat(occurred_at.replace("Z", "+00:00")).timestamp() * 1000
    except ValueError:
        return 0.3
    days = max(0.0, (now_ms - then) / 86_400_000)
    return math.exp(-days / 730)


def proximity_decay(distance_m: float, radius_m: float) -> float:
    if distance_m >= radius_m:
        return 0.0
    return 1.0 - distance_m / radius_m


def haversine_m(a: LatLng, b: LatLng) -> float:
    r = 6_371_000
    p1 = math.radians(a["lat"])
    p2 = math.radians(b["lat"])
    dp = math.radians(b["lat"] - a["lat"])
    dl = math.radians(b["lng"] - a["lng"])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def bearing_degrees(from_pt: LatLng, to_pt: LatLng) -> int:
    """Compass heading from from_pt toward to_pt (0–360)."""
    lat1 = math.radians(from_pt["lat"])
    lat2 = math.radians(to_pt["lat"])
    dlon = math.radians(to_pt["lng"] - from_pt["lng"])
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return int((math.degrees(math.atan2(y, x)) + 360) % 360)


def compute_weight(hotspot: RawHotspot, center: LatLng, radius_m: float) -> float:
    dist = haversine_m(center, {"lat": hotspot["lat"], "lng": hotspot["lng"]})
    prox = proximity_decay(dist, radius_m)
    rec = recency_decay(hotspot.get("occurredAt", ""))
    sev = hotspot.get("severity", 2) / 5
    return min(1.0, sev * rec * prox)


def area_risk_to_safety_score(total_weight: float) -> int:
    normalized = min(total_weight / MAX_AREA_RISK, 1.0)
    return round(max(0, min(100, 100 - normalized * 100)))


def route_exposure_to_safety_score(exposure: float) -> int:
    normalized = min(exposure / MAX_ROUTE_EXPOSURE, 1.0)
    return round(max(0, min(100, 100 - normalized * 100)))


def score_to_risk_level(safety_score: int) -> RiskLevel:
    if safety_score >= 75:
        return "low"
    if safety_score >= 50:
        return "moderate"
    if safety_score >= 25:
        return "high"
    return "very_high"


def with_weights(
    hotspots: list[RawHotspot],
    center: LatLng,
    radius_m: float,
    *,
    min_weight: float = 0.0,
) -> list[Hotspot]:
    weighted: list[Hotspot] = []
    for h in hotspots:
        w = round(compute_weight(h, center, radius_m) * 1000) / 1000
        if w >= min_weight:
            weighted.append({**h, "weight": w})
    weighted.sort(key=lambda x: x.get("weight", 0), reverse=True)
    return weighted


def sample_polyline(points: list[LatLng], spacing_m: float = 40) -> list[LatLng]:
    if len(points) < 2:
        return points
    out: list[LatLng] = [points[0]]
    carry = 0.0
    for i in range(1, len(points)):
        a, b = points[i - 1], points[i]
        dist = haversine_m(a, b)
        if dist < 1:
            continue
        steps = max(1, int((carry + dist) // spacing_m))
        for s in range(1, steps + 1):
            t = min(1.0, (s * spacing_m - carry) / dist)
            if t <= 1:
                out.append(
                    {"lat": a["lat"] + t * (b["lat"] - a["lat"]), "lng": a["lng"] + t * (b["lng"] - a["lng"])}
                )
        carry = max(0.0, carry + dist - steps * spacing_m)
    if out[-1]["lat"] != points[-1]["lat"] or out[-1]["lng"] != points[-1]["lng"]:
        out.append(points[-1])
    return out


def template_explanation(kind: str, top: list[Hotspot], safety_score: int) -> str:
    if not top:
        if kind == "route":
            return f"This route scores {safety_score} out of 100 — very few incidents reported along the path."
        return f"This area scores {safety_score} out of 100 — relatively quiet based on historical reports."
    cats = ", ".join({h["category"].lower() for h in top[:3]})
    if kind == "route":
        return (
            f"This route scores {safety_score} out of 100. Main concerns nearby include {cats} "
            "— consider the safer alternative if available."
        )
    return (
        f"This area scores {safety_score} out of 100 with nearby reports of {cats}. "
        "Stay aware of your surroundings."
    )
