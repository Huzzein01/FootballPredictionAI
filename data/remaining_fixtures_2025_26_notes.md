# Remaining Fixtures Template

Sources checked on 2026-05-12:

- Premier League fixtures: Sky Sports and BBC Sport
- La Liga fixtures: Sky Sports and BBC Sport
- Bayern Munich fixtures: BBC Sport and Sky Sports
- PSG fixtures: BBC Sport and ESPN

The CSV file uses the exact club names from the local training CSVs, so it can be pasted directly into the web app's fixture importer after odds are added.

Current app odds snapshot, refreshed 2026-05-15:

- The live prediction board reads `data/remaining_fixtures_2025_26_with_odds.csv`.
- Public 1-X-2 odds are saved in the CSV with `oddsSourceUrl` and `oddsSnapshotAt`.
- Public odds are now available for 20 of the 22 listed fixtures, and for 16 of the 18 still-unplayed fixtures after played-match exclusion.
- Sunderland vs Chelsea and Valencia vs Barcelona are still marked model-only because the checked public pages did not expose a current 1-X-2 market.
- Odds move often, so this file should be treated as a dated snapshot rather than a permanent market record.

Reference pages checked:

- https://www.oddschecker.com/us/soccer/premier-league/man-city-v-crystal-palace
- https://www.sportytrader.com/en/odds/football/england/
- https://www.sportytrader.com/en/odds/aston-villa-liverpool-7664828/
- https://www.sportytrader.com/en/odds/brighton-manchester-united-7664836/
- https://www.sportytrader.com/en/odds/crystal-palace-arsenal-7664838/
- https://www.sportytrader.com/en/odds/liverpool-brentford-7664840/
- https://www.sportytrader.com/en/odds/manchester-city-aston-villa-7664841/
- https://www.oddschecker.com/us/soccer/premier-league/arsenal-v-burnley
- https://www.sportytrader.com/en/odds/manchester-united-nottingham-forest-7664833/
- https://www.oddschecker.com/football/english/premier-league/chelsea-v-tottenham/winner
- https://www.sportytrader.com/en/odds/football/spain/
- https://www.sportytrader.com/es/apuestas/deportivo-alaves-barcelona-7687651/
- https://www.sportytrader.com/en/odds/atletico-madrid-girona-7687662/
- https://www.sportytrader.es/cuotas/barcelona-real-betis-7687663/
- https://www.oddschecker.com/us/soccer/la-liga-primera/sevilla-v-real-madrid/moneyline
- https://www.xscores.com/betting/football-predictions/real-madrid-cf-real-oviedo-prediction-14-05-2026/
- https://www.sportytrader.com/en/odds/football/germany/
- https://www.sportytrader.com/en/odds/bayern-munich-koln-7680162/
- https://www.sportytrader.com/en/odds/football/france/
- https://www.sportytrader.com/en/odds/paris-fc-psg-7679431/
- https://ratingbet.com/football/match/chelsea-vs-sunderland/
- https://www.betus.com.pa/la-liga/matchups/barca-vs-val/

Cup and European fixtures to treat carefully:

- 2026-05-16, FA Cup final: Chelsea vs Man City at Wembley. Both clubs are EPL, but the match is neutral-site and outside league training.
- 2026-05-23, DFB-Pokal final: Bayern Munich vs Stuttgart in Berlin. Same neutral-site caveat.
- 2026-05-30, UEFA Champions League final: Paris SG vs Arsenal in Budapest. Current model is domestic-league only and should not be used for cross-league prediction unless we add a market-only/cross-league mode.
