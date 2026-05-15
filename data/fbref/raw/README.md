# FBref Raw Player Stats

Put FBref table CSV exports in this folder.

Use this filename pattern so the importer can read season, league, and stat type:

```text
2025-2026_EPL_standard.csv
2025-2026_EPL_shooting.csv
2025-2026_LaLiga_standard.csv
2025-2026_Bundesliga_passing.csv
2025-2026_Ligue1_keepers.csv
```

Supported league keys:

- `EPL`
- `LaLiga`
- `Bundesliga`
- `Ligue1`

Supported stat types:

- `standard`
- `shooting`
- `passing`
- `defense`
- `possession`
- `misc`
- `keepers`

On FBref, open a league player-stat page, choose `Share & Export`, then `Get table as CSV`, and save the result here.
