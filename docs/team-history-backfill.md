# Football team-history backfill: mandatory ten-step process

Every import must complete these steps in order. A team may not enter historical training until all ten have passed.

1. Register the canonical club identity and aliases in `data/teams/history/<slug>.json`; never overwrite an existing record.
2. Attach five ranked research tracks for that club: official club archive, official domestic competition/association, UEFA/FIFA where applicable, RSSSF, and worldfootball.net.
3. Retrieve each source into `data/teams/history/raw/` with URL, retrieval time, checksum, and licence/terms review.
4. Convert raw evidence into a reviewed normalized artifact. Preserve only date, competition, stage, opponent, venue, score, source provenance, and table facts.
5. Ingest the normalized artifact with `npm run ingest:team-history`; the importer performs identity normalization and idempotent match merging.
6. Rebuild league and competition standings only from recorded settled matches: `npm run rebuild:team-history-standings`.
7. Run `npm run qa:team-history`; resolve every schema, duplicate, date, score, or provenance failure.
8. Run `npm run report:team-history`; every requested season from 1985 and every competition must have positive coverage before certification.
9. Create leakage-safe point-in-time snapshots with `npm run build:team-history-snapshots -- --cutoff=YYYY-MM-DD` and validate chronologically.
10. Train and publish only after the coverage report says `readyForFullHistoricalTraining: true`; preserve the exact source-manifest and model artifact used.

The currently bundled public archive covers selected top domestic leagues from 1993 onward. It is a seed, not certification for 1985 coverage, lower divisions, domestic cups, continental matches, or friendlies.
