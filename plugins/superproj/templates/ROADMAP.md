# {{PROJECT_NAME}} — Roadmap

The plan of record. Milestones are ordered; features inside a milestone are
ordered by dependency, then by value. This file answers "what next, and why not
something else".

Status vocabulary (features): `planned` · `in-progress` · `blocked` · `in-review` · `done` · `dropped`
Status vocabulary (milestones): `planned` · `active` · `done`

Rules:

- One feature `in-progress` at a time per worktree. Finish or park before starting another.
- A feature is not `planned`-ready until its dossier has acceptance criteria.
- Never delete a row. Set it to `dropped` and say why in the notes under the milestone.
- `Reqs` links back to requirement IDs in `PRD.md`, so scope creep is visible.

<!-- Table columns are parsed by sp.js. Keep the column order:
     ID | Feature | Status | Deps | Reqs | Plan | Dossier -->

## M1 — Walking skeleton

- **Status:** active
- **Goal:** the thinnest end-to-end slice that runs, is deployed, and is tested.
- **Exit criteria:** a user can complete the single most important path; CI is green; one command runs it locally.

| ID | Feature | Status | Deps | Reqs | Plan | Dossier |
|---|---|---|---|---|---|---|
| F-0NN | (replace: one row per feature) | planned | — | R-0NN | — | — |

Notes:

- (record scope changes and drops here, with a link to the decision that caused them)

## M2 — (next milestone)

- **Status:** planned
- **Goal:**
- **Exit criteria:**

| ID | Feature | Status | Deps | Reqs | Plan | Dossier |
|---|---|---|---|---|---|---|

## Out of scope for now

Things deliberately not on the roadmap, so they stop coming up:

- (item — and the reason)
