# Dated historical source strategy

The training corpus accepts a match only when it has an individual match date, score, named opponents and attributable source metadata. Aggregate two-leg scores and season-level participation lists are useful for discovery, but are never converted into training rows.

## Primary/authorized sources to use first

- **UEFA information kits and match histories**: the official pages expose dated historical Champions League, UEFA Cup/Europa League and Cup Winners' Cup results. Use them to corroborate old European fixtures and retain the exact UEFA URL as provenance.
- **National associations and competition organisers**: use official cup archives for domestic cups where they expose match-by-match dates. Their participation/draw pages are also the preferred authoritative participation index.
- **Club archives**: official fixture lists are preferred for a club's preseason programme, especially tours and friendlies against European or South American opposition.

## Supplementary, reviewable public sources

- `jalapic/engsoccerdata` contains dated CSVs for English leagues, FA Cup, League Cup, English playoffs, European champions and selected European domestic leagues. Its `teamnames.csv` is an evidence source for English-name aliases, not permission to fuzzy-merge unrelated clubs.
- `openfootball` publishes CC0 schedule/result datasets for many leagues and tournaments. It is useful to locate gaps and to corroborate dates; retain the repository/version and source file in provenance.
- Transfermarkt has a date-filtered fixture history view and competition pages, including friendlies. It may be used only after a terms-compliant, authorized collection flow is confirmed. Do not automate logged-in scraping or use it as a source without preserving URL, retrieval time and the exact displayed fixture.

## Per-club resource verification

A provider name or generic home page is **not** a verified resource for a club. The audited registry is deliberately separate from match data, so a URL cannot be inferred from a fuzzy name match or silently applied across several clubs.

Use `npm run report:team-history-sources` to see the exact shortfall. A reviewed import file contains only entries shaped like this:

```json
{
  "sources": [{
    "teamSlug": "1-fc-kaiserslautern",
    "provider": "Official club archive",
    "url": "https://example.club/history",
    "verifiedAt": "2026-08-04",
    "evidence": "Club-owned archive page identifies the club and exposes its fixture history."
  }]
}
```

Run `npm run import:team-history-sources -- --input=reviewed-sources.json` only after the URL and club identity have been checked. The importer rejects non-HTTPS URLs, duplicate provider/team pairs and unknown team slugs. It never changes fixtures or merges identities.

## Scope

“Every competition” means every **major** competition for which participation is verified: domestic league, principal national cup, significant domestic league cup/playoff, UEFA club competition (including historical UEFA Cup and Cup Winners' Cup), FIFA/continental club world competition, and dated cross-confederation preseason friendlies involving European and South American clubs. Missing years are excluded until a participation index and dated match source prove them; they are never fabricated.

## UEFA collection implementation

`npm run collect:uefa-history -- --from=1985 --to=2025` uses UEFA's public match endpoint for competition IDs 1 (European Cup/Champions League), 2 (Cup Winners' Cup), and 14 (UEFA Cup/Europa League). It stores a manifest containing the exact requests, hashes and retrieval times. The API payload cache is intentionally ignored by Git because it contains large player-event data that can be regenerated from those public requests. Run `npm run normalize:uefa-history`, then review and use `npm run ingest:team-history -- --input=...` to apply the cleaned team-perspective artifact.
