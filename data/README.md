# Crime dataset (local only)

CSV files are **not** committed to git (often 100MB+). Place your file in this folder:

```
data/Police_Department_Incident_Reports__2018_to_Present_20260619.csv
```

The ingest script auto-detects the schema (2018–present vs legacy) and picks the newest `.csv` in `data/` if the default filename is missing.

## Ingest

```bash
cd backend

# Local seed cache (~20k rows with SF coordinates)
npm run ingest -- --seed-only

# Push to InsForge (requires INSFORGE_API_KEY in .env)
npm run ingest -- --limit 20000
```

See [backend/insforge/README.md](../backend/insforge/README.md) for InsForge setup.
