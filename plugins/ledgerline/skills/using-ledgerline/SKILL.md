---
name: using-ledgerline
description: The Ledgerline contract — the docs/project/ ledger layout, ID scheme, status vocabulary, invariants, and which Ledgerline skill to use when. Read this before creating or editing any ledger file (PRD, ROADMAP, DECISIONS, FOLLOWUPS, LESSONS, JOURNAL, feature dossiers), before answering questions about project state, and whenever a SessionStart brief mentions a Ledgerline ledger.
when_to_use: Trigger on "where are we in the project", "what's left", "what did we decide", "why did we do it this way", "what do we still owe", before writing to anything under docs/project/, and at the start of any session in a repo that has a Ledgerline ledger.
---

# Using Ledgerline

Ledgerline is project-level memory. Superpowers is feature-level craft. They do
not overlap, and you need both.

| Question | Owner |
|---|---|
| What are we building, and why? | Ledgerline (`PRD.md`) |
| What do we build next, and what blocks it? | Ledgerline (`ROADMAP.md`) |
| How do we build *this one thing* well? | Superpowers (`brainstorming`, `writing-plans`, TDD, review) |
| Why is it like this? | Ledgerline (`DECISIONS.md`) |
| What did we knowingly leave undone? | Ledgerline (`FOLLOWUPS.md`) |
| What should we do differently next time? | Ledgerline (`LESSONS.md`) |
| Where was the thread dropped? | Ledgerline (`JOURNAL.md`) |

Superpowers' `docs/plans/` files stay exactly where they are. Ledgerline links to
them; it never replaces them.

## The ledger

```
docs/project/
├── STATE.md           GENERATED — where we are right now. Never hand-edit.
├── PRD.md             what and why; requirements with stable IDs (R-001)
├── ARCHITECTURE.md    living map: stack, module map, invariants, undecided
├── ROADMAP.md         milestones (M1) → features (F-001) with status and deps
├── DECISIONS.md       append-only ADRs (D-001)
├── FOLLOWUPS.md       deferred work with triggers (U-001)
├── LESSONS.md         append-only, each ending in a rule (L-001)
├── JOURNAL.md         append-only, one entry per work session
└── features/
    └── F-001-slug.md  dossier: goal, acceptance criteria, status log, review, verification
```

`STATE.md` is derived from the others and exists for humans reading the repo and
for git history. It is never a source of truth: to change a fact in it, change
the file that owns the fact and regenerate. Never edit it, and never read it in
preference to running `ledger.js status`, which cannot be stale.

## Tooling

Never hand-count IDs or dates. Use the engine:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" status          # full rollup (markdown)
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" status --json    # same, machine-readable, includes nextIds
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" state            # regenerate STATE.md (writes only if changed)
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" check            # validate; exit 1 on errors
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" next-id D        # next free ID for F|D|U|L|R|M
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" today            # date stamp, do not guess it
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" init             # scaffold a missing ledger (idempotent)
```

After any batch of ledger edits, run `state` then `check`, and fix what `check`
reports before moving on. Forgetting `state` is not silent — `check` warns when
STATE.md no longer matches the ledger.

## Vocabulary

Features: `planned` · `in-progress` · `blocked` · `in-review` · `done` · `dropped`
Milestones: `planned` · `active` · `done`
Follow-ups: `open` · `closed` · `dropped`
Decisions: `accepted` · `superseded by D-0NN` · `reverted`

IDs are permanent. Nothing is ever deleted or renumbered — it is `dropped` or
`superseded`, with a reason.

## Invariants

1. **Intent lives in the ledger, truth lives in git.** When they disagree, stop and reconcile with `/ledgerline:resume` before doing new work.
2. **Append-only files are append-only.** `DECISIONS.md`, `LESSONS.md`, `JOURNAL.md`: add at the bottom, never rewrite history. Change your mind with a new entry that links back.
3. **One feature `in-progress` per worktree.** Park or finish before starting another. Parking is `blocked` with the reason — never `planned`, which erases the fact it was ever started. And do not park a `must` to start a `should` or a `could`: name that trade and let the user pick, rather than making it by choosing what to work on.
4. **Acceptance criteria before plan.** A feature with no verifiable criteria is not ready to be planned, and cannot be closed.
5. **Decide in the moment.** A decision recorded at the end of a session has already lost the alternatives that made it interesting.
6. **No trigger, no follow-up.** If you cannot name the condition that makes deferred work urgent, drop it rather than pretend it is tracked.
7. **Done means verified.** Acceptance criteria ticked with evidence — not "code written", not "tests pass locally, probably".
8. **The ledger ships with the code.** Update it in the same commit as the work it describes, and make that commit yourself — in a tracked project the record *is* part of the deliverable, so committing it is finishing the task rather than a separate act needing its own permission. Never end a session with the ledger dirty: an uncommitted ledger is the one state `ledger.js check` calls healthy and git calls nonexistent, and it is invisible to exactly the next session that would have caught it. Commit where the feature dossier says the work lives; if it says nothing, follow whatever the repo's recent history does and record that choice in the dossier so the next session inherits it instead of guessing again. Committing is not merging and not pushing — those stay the user's call.

## Router

| Situation | Skill |
|---|---|
| New project, from a PRD or from an idea | `/ledgerline:kickoff` |
| Fresh session, or back after a break | `/ledgerline:resume` |
| "Where are we?" | `/ledgerline:status` |
| About to build the next thing | `/ledgerline:start-feature` |
| That thing is built and reviewed | `/ledgerline:finish-feature` |
| A non-obvious choice just got made | `/ledgerline:decide` |
| Something is being deliberately left undone | `/ledgerline:followup` |
| Something surprised us or cost too much | `/ledgerline:lesson` |
| Milestone's features are all done | `/ledgerline:milestone-review` |
| Scope changed, priorities moved, requirement added | `/ledgerline:roadmap` |

## Working with a ledger present

Before starting any implementation work, check the roadmap for the feature it
belongs to. Work that matches no feature is either a follow-up, a bug (which
gets a feature row if it is not trivial), or scope creep that needs
`/ledgerline:roadmap` first. Say so rather than quietly building it.

**Some plan changes are a stop, not a step.** Which ones is decidable from the
ledger, so decide it before writing anything:

| What the work turns out to need | Then |
|---|---|
| a feature row for a requirement the user already approved | that is executing the plan — proceed |
| a **new** requirement, a reworded or reprioritised one, or something the plan puts out of scope | **stop** |

In the second case, write the proposed rows out **in your reply, not into the
files** — exact IDs, status, deps, the requirement they map to — so that agreeing
costs one word and the working tree stays clean until it does. Never author the
change on disk and then build against it in the same turn: an entry written to
authorise work already underway is a rubber stamp, and it leaves a ledger that
validates perfectly around a decision that was the user's to make. "Just do it"
is a request for the work, not permission to rewrite the plan the work has to fit.

Factual corrections are a different thing and are not gated: a ledger claim the
code contradicts gets fixed and committed like any other work.

The plan of record is the user's text. Requirements in `PRD.md` — wording and
priority — are never edited to accommodate work in flight. If a requirement is
wrong, quote it, say what it should say, and stop.

### Red flags — hand back instead

| Thought | Reality |
|---|---|
| "I'll add the roadmap row *and* build it, to save a round trip" | The round trip is the approval. That is what you are saving away. |
| "This requirement is worded badly, I'll tighten it to match" | Rewriting the target is how a miss becomes a hit. Propose the wording; don't apply it. |
| "`planned` is tidier than `blocked` for a parked feature" | `planned` says the work never started. Someone will believe it. |
| "The user said just do it, so the plan change is implied" | Then they can say so in one word. Ask for the word. |
| "`ledger.js check` passes, so the ledger is fine" | `check` validates consistency, not authority. A ledger edited to match unapproved work passes cleanly. |
| "They didn't ask me to commit" | In a tracked project the record is the deliverable. Commit it — then stop, because merging and pushing are theirs. |
| "I'll leave it uncommitted so they can review first" | Review reads a diff, and a commit *is* a diff. Dirty means the next session inherits nothing. |

The last one is the trap the others hide behind. A clean `check` is not evidence
that what you did was yours to do.

Ledger files use `merge=union` in `.gitattributes` so parallel worktrees append
without conflicts. That can produce duplicate IDs after a merge — `ledger.js check`
catches them; fix by renumbering the *newer* entry.
