# Team History Pipeline — 10-Step Process

Follow these steps in order, every time historical team data is extended or refreshed.
Do not skip a step or reorder them; each step depends on the previous one's output.

1. **Registry check** — `npm run init:team-history`
   Creates a `data/teams/history/<slug>.json` scaffold for any team present in
   `data/teams/results/_index.json` that doesn't already have one. Never overwrites
   an existing file.

2. **Source planning** — `npm run refresh:team-history-sources`
   Assigns each club its ranked top-5 research sources (official club archive,
   domestic association, UEFA, RSSSF, worldfootball.net) via
   `src/footballHistory/sources.js`. Fill in the blank "Official club archive" URL
   per club as it's discovered — never leave a fabricated URL.

3. **Collection** — run the relevant `collect:*` script(s) for the source(s) in scope
   (`collect:engsoccerdata-history`, `collect:uefa-history`, `collect:rsssf-coppa-italia`,
   `collect:dfb-pokal-history`, `collect:englishfootball-standings`, `collect:football-history`).
   Only pull matches with a real date; discard undated rows at this stage.

4. **1985 floor enforcement** — every collector/normalizer must clip results so no
   match earlier than the 1985–86 season is retained. If a club's real history starts
   later than 1985, that's fine — do not backfill or fabricate earlier seasons.

5. **Normalization** — run the matching `normalize:*` script to convert raw source
   rows into the shared `football-team-history-v1` schema (competition, opponent,
   score line, date, season).

6. **Identity reconciliation** — `npm run reconcile:team-history`
   Merges duplicate/aliased club identities so the same club isn't tracked under two
   slugs. Run `report:team-history-identities` first to review candidates.

7. **Deduplication & corruption repair** — `npm run repair:football-history-import`
   then `npm run qa:team-history`. Removes redundant/duplicate match rows and flags
   any structurally invalid records before they reach training data.

8. **Standings & competition rebuild** — `npm run rebuild:team-history-standings`
   and `npm run rebuild:team-history-competitions`. Recomputes, per season: league
   standing, competition standing, and — for knockout competitions — the round/position
   at which the club was eliminated.

9. **Coverage verification** — `npm run report:team-history`
   and `npm run report:team-history-training`. Confirms which clubs have verified,
   dated, deduplicated coverage back to (or short of) 1985, and which are eligible
   for training. Do not claim "complete" coverage until `readyForFullHistoricalTraining`
   is true.

10. **Training dataset build & retrain** — `npm run build:team-history-training`
    then `npm run train`. Only verified, cleaned, deduplicated rows enter the training
    set — partial-coverage clubs train on whatever verified span they have; no
    interpolated or guessed seasons.

Re-run from step 1 whenever new teams are added to the results registry; re-run from
step 3 whenever a new source is ingested for existing teams.
