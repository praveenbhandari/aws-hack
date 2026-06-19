#!/usr/bin/env python3
"""
Ingest SFPD CSV → InsForge hotspots table + local seed file.

Usage:
  python scripts/ingest_hotspots.py --all --replace
  python scripts/ingest_hotspots.py --limit 20000
  python scripts/ingest_hotspots.py --seed-only --limit 20000
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running from backend/ or repo root
_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from guardian.config import config, has_insforge  # noqa: E402
from guardian.services.hotspots import (  # noqa: E402
    clear_hotspots_table,
    insert_hotspots_batch,
)
from guardian.services.scoring import category_to_severity  # noqa: E402

SEED_OUT = _BACKEND / "data" / "seed-hotspots.json"
DATA_DIR = _BACKEND.parent / "data"
DEFAULT_CSV = "Police_Department_Incident_Reports__2018_to_Present_20260619.csv"
BATCH = 500

SF_LAT_MIN, SF_LAT_MAX = 37.7, 37.84
SF_LON_MIN, SF_LON_MAX = -122.52, -122.35


def resolve_csv_path() -> Path:
    if config.crime_csv_path:
        p = Path(config.crime_csv_path)
        if p.is_absolute():
            return p
        return (_BACKEND / p).resolve()
    preferred = DATA_DIR / DEFAULT_CSV
    if preferred.exists():
        return preferred
    csvs = sorted(DATA_DIR.glob("*.csv")) if DATA_DIR.exists() else []
    if csvs:
        return csvs[-1]
    return preferred


def parse_date(date_str: str) -> str:
    trimmed = (date_str or "").strip()
    if not trimmed:
        return datetime.now(timezone.utc).isoformat()
    ymd = re.match(r"^(\d{4})/(\d{2})/(\d{2})", trimmed)
    if ymd:
        yyyy, mm, dd = ymd.groups()
        return datetime(int(yyyy), int(mm), int(dd), 12, 0, 0, tzinfo=timezone.utc).isoformat()
    mdy = re.match(r"^(\d{2})/(\d{2})/(\d{4})", trimmed)
    if mdy:
        mm, dd, yyyy = mdy.groups()
        return datetime(int(yyyy), int(mm), int(dd), 12, 0, 0, tzinfo=timezone.utc).isoformat()
    try:
        return datetime.fromisoformat(trimmed.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


def in_sf_bounds(lat: float, lng: float) -> bool:
    return SF_LAT_MIN <= lat <= SF_LAT_MAX and SF_LON_MIN <= lng <= SF_LON_MAX


def extract_hotspot(row: dict[str, str], line_num: int) -> dict | None:
    if "Latitude" in row or "Longitude" in row:
        lat = float(row.get("Latitude") or "nan")
        lng = float(row.get("Longitude") or "nan")
        if lat != lat or lng != lng or (lat == 0 and lng == 0):
            return None
        if not in_sf_bounds(lat, lng):
            return None
        category = row.get("Incident Category") or row.get("Incident Subcategory") or "OTHER"
        return {
            "id": f"sfpd-{row.get('Row ID') or row.get('Incident ID') or line_num}",
            "lat": lat,
            "lng": lng,
            "category": category,
            "severity": category_to_severity(category),
            "occurredAt": parse_date(row.get("Incident Datetime") or row.get("Incident Date") or ""),
            "source": "sfpd",
        }
    lat = float(row.get("Y") or "nan")
    lng = float(row.get("X") or "nan")
    if lat != lat or lng != lng or not in_sf_bounds(lat, lng):
        return None
    category = row.get("Category") or "OTHER OFFENSES"
    return {
        "id": f"sfpd-{row.get('PdId') or line_num}",
        "lat": lat,
        "lng": lng,
        "category": category,
        "severity": category_to_severity(category),
        "occurredAt": parse_date(row.get("Date") or ""),
        "source": "sfpd",
    }


async def flush_batch(batch: list[dict], inserted: int, upload: bool) -> int:
    if not upload or not batch:
        return inserted
    payload = [
        {
            "lat": r["lat"],
            "lng": r["lng"],
            "category": r["category"],
            "severity": r["severity"],
            "occurred_at": r["occurredAt"],
            "source": r["source"],
        }
        for r in batch
    ]
    n = await insert_hotspots_batch(payload)
    print(f"\rUploaded {inserted + n:,} rows…", end="", flush=True)
    return inserted + n


async def ingest(args: argparse.Namespace) -> None:
    csv_path = resolve_csv_path()
    if not csv_path.exists():
        print("CSV not found:", csv_path)
        sys.exit(1)

    row_limit = float("inf") if args.all else args.limit
    limit_label = "ALL valid rows" if args.all else f"{args.limit:,}"
    print("Reading", csv_path, f"({limit_label} with SF coordinates)")

    if not args.seed_only and args.replace and has_insforge():
        print("Clearing existing hotspots table…")
        await clear_hotspots_table()

    upload = not args.seed_only and has_insforge()
    if not args.seed_only and not has_insforge():
        print("\n[insforge] Not configured — will only write local seed.")

    skipped = 0
    parsed = 0
    inserted = 0
    batch: list[dict] = []
    seed_sample: list[dict] = []
    seed_cap = 25_000 if args.all else int(row_limit)

    with csv_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        schema = "2018–present" if "Latitude" in headers else "legacy"
        print("Schema:", schema)

        for line_num, row in enumerate(reader, start=2):
            if parsed >= row_limit:
                break
            hotspot = extract_hotspot(row, line_num)
            if not hotspot:
                skipped += 1
                continue
            parsed += 1
            if len(seed_sample) < seed_cap:
                seed_sample.append(hotspot)
            batch.append(hotspot)
            if len(batch) >= BATCH:
                inserted = await flush_batch(batch, inserted, upload)
                batch = []
            if parsed % 50_000 == 0:
                print(f"\rScanned {line_num:,} lines, {parsed:,} valid…", end="", flush=True)

    inserted = await flush_batch(batch, inserted, upload)

    print(f"\nParsed {parsed:,} valid SF incidents (skipped {skipped:,} without SF coords)")
    SEED_OUT.write_text(json.dumps(seed_sample, separators=(",", ":")))
    print(f"Wrote seed sample ({len(seed_sample):,} rows) →", SEED_OUT)

    if upload:
        print(f"Uploaded {inserted:,} rows to InsForge hotspots")
    elif not args.seed_only:
        print("Skipped InsForge upload — configure keys or use without --seed-only")
    print("Done")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest SFPD crime CSV into InsForge")
    parser.add_argument("--seed-only", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--limit", type=int, default=20_000)
    args = parser.parse_args()

    import asyncio

    asyncio.run(ingest(args))


if __name__ == "__main__":
    main()
