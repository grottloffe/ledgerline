# {{PROJECT_NAME}} — Decision log

Append-only. Newest at the bottom. Never edit the substance of a past entry: to
change your mind, add a new decision and mark the old one
`superseded by D-0NN`. The history of what you believed and why is the point.

Log a decision when a choice is not obvious in hindsight: a library or service
picked over an alternative, a schema or protocol shape, a tradeoff accepted, a
constraint discovered, a "we deliberately do it the slow way" call.

Do not log: formatting, naming, or anything the code already states plainly.

Status: `accepted` · `superseded by D-0NN` · `reverted`

---

### D-001 — Track this project with a Ledgerline ledger

- **Date:** {{DATE}}
- **Status:** accepted
- **Context:** Superpowers handles one feature at a time well, but nothing carried the project's memory between features and sessions.
- **Options considered:**
  - Keep notes in CLAUDE.md — cheap, but unstructured and it silently rots.
  - Issue tracker — good for tasks, poor for decisions and lessons, and off-disk.
  - A markdown ledger in the repo — diffable, reviewable, and in front of the agent by default.
- **Decision:** A markdown ledger under `docs/project/`, committed with the code.
- **Consequences:** Ledger drift is now possible and must be checked (`/ledgerline:resume`). Every session pays a small update cost in exchange for cheap resumption.
- **Revisit when:** the ledger takes longer to maintain than it saves.
- **Links:** —
