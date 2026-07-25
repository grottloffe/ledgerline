# Changelog

## 0.1.0 — 2026-07-25

First version.

- Ledger model under `docs/project/`: PRD, architecture, roadmap, decisions, follow-ups, lessons, journal, feature dossiers, milestone reviews.
- Eleven skills: `kickoff`, `resume`, `status`, `start-feature`, `finish-feature`, `decide`, `followup`, `lesson`, `milestone-review`, `roadmap`, and the `using-superproj` contract.
- `superproj-auditor` read-only agent for ledger-versus-repository drift.
- `sp.js` engine: `init`, `status` (markdown / brief / JSON), `check`, `next-id`, `today`, `paths`. No dependencies.
- `SessionStart` hook injecting a project brief, using exec-form for Windows safety.
- Union-merge `.gitattributes` for append-only ledger files.
