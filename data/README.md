# Crime dataset (local only)

The historical SFPD incident reports CSV is **not** stored in this repository because of its size (~500MB).

## Setup

1. Download the dataset locally and place it in this `data/` directory (filename should match what the ingest script expects).
2. Run the seed ingest from the repo root:

```bash
cd backend && npm run ingest -- --seed-only
```

This loads the CSV into the local pipeline without committing it to Git.
