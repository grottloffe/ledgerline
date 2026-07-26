---
name: resume
description: Rebuild context and reconcile the ledger with reality at the start of a session or after a break. Compares the roadmap against git history and the working tree, detects drift, and proposes the next concrete action. Use at the start of any session that will do project work, after returning to a project, or whenever the ledger and the code appear to disagree.
when_to_use: Trigger on "where were we", "let's continue", "pick up where we left off", "what was I doing", and at the start of a session in a repo with a Ledgerline ledger.
---

# Resuming work

Cheap to run, expensive to skip. Drift compounds: one stale status turns into a
plan executed twice, or a feature everyone thinks is done.

## 1. Read the ledger

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" status --json
```

Then read the last two `JOURNAL.md` entries in full, and the dossier of anything
`in-progress` or `in-review`.

## 2. Read reality

```
git log --oneline -25
git status --short
git branch --show-current
git worktree list
```

Compare the last journal entry's date against the newest commit. Commits after
the last journal entry are unrecorded work — that is the gap you are here to close.

## 3. Reconcile

Drift patterns and what each means:

| Signal | Likely truth |
|---|---|
| Feature `in-progress`, its branch merged, tests pass | It landed and was never closed → `/ledgerline:finish-feature` |
| Feature `in-progress`, no branch, no commits | It never started → set back to `planned` |
| Feature `done`, unchecked acceptance criteria | Closed on vibes → verify now, or reopen |
| Commits touching areas no feature covers | Undocumented work → find its feature or record what happened |
| Plan file in `docs/plans/` linked from nothing | Abandoned or orphaned plan → link it or note the abandonment |
| Uncommitted changes in the tree | Interrupted session → work out what they were part of before touching anything |
| Journal says "next: X", roadmap says X is `planned`, nothing happened | Clean pickup, no drift |

Resolve with evidence, not assumption. Git wins on what *happened*; the ledger
wins on what was *intended*. When they conflict irreducibly, ask.

Apply the corrections to the ledger, run `ledger.js state`, and add a journal entry
noting the reconciliation if you changed anything of substance.

## 4. Restate and propose

Give the user a short brief they can correct:

- Where the project is, in two sentences.
- What was in flight and its actual state.
- What drift you found and what you did about it.
- The one thing you propose to do next, and why that rather than the alternatives.

Then wait. Do not start implementing in the same turn as the reconciliation —
if your reading of the drift is wrong, you want to hear about it before writing
code, not after.

## 5. Uncommitted work

Never `checkout`, `stash`, `reset`, or `clean` uncommitted changes as part of
resuming. Describe what is there and let the user decide. Losing an
interrupted session's work is unrecoverable and unforgivable.
