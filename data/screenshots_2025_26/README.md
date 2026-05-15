# 2025-26 Screenshot Training Data

This folder stores original FBref screenshot files that were available on local disk and copied into the project as training evidence.

Source checked:

```text
C:\Users\adebi\OneDrive\Pictures\Screenshots
```

At copy time, only this matching original PNG was present locally:

```text
Screenshot 2026-05-14 235406.png
```

The full screenshot set that was attached in chat was already processed into OCR TSV files and normalized player-stat data here:

```text
data/fbref/ocr
data/fbref/processed/fbref_player_stats.json
data/fbref/processed/fbref_player_stats.csv
```

Data lineage:

```text
FBref screenshots -> OCR TSV -> normalized player rows -> model player features and parlay player props
```
