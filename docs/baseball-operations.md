# Baseball production operations

Use separate development, staging, and production data roots and credentials. Keep secrets in environment variables only; never commit `.env.local`.

Promote only a model with a passing dataset manifest, chronological backtest, and registry gate:

`node scripts/promote_baseball_model.js data/baseball_model.json data/baseball/chronological_backtest.json`

Rollback is explicit and auditable:

`node scripts/rollback_baseball_model.js <registry-id>`

Retain immutable raw payloads, snapshots, prediction records, settlements, manifests, and registry artifacts. Alert and disable prediction service when the monitoring drift guard trips; investigate source freshness, calibration, and data-quality flags before re-enabling.
