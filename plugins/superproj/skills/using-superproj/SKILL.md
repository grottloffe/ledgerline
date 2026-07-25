---
name: using-superproj
description: The SuperProj contract — the docs/project/ ledger layout, ID scheme, status vocabulary, invariants, and which SuperProj skill to use when. Read this before creating or editing any ledger file (PRD, ROADMAP, DECISIONS, FOLLOWUPS, LESSONS, JOURNAL, feature dossiers), before answering questions about project state, and whenever a SessionStart brief mentions a SuperProj ledger.
when_to_use: Trigger on "where are we in the project", "what's left", "what did we decide", "why did we do it this way", "what do we still owe", before writing to anything under docs/project/, and at the start of any session in a repo that has a SuperProj ledger.
---

# Using SuperProj

SuperProj is project-level memory. Superpowers is feature-level craft. They do
not overlap, and you need both.

| Question | Owner |
|---|---|
| What are we building, and why? | SuperProj (`PRD.md`) |
| What do we build next, and what blocks it? | SuperProj (`ROADMAP.md`) |
| How do we build *this one thing* well? | Superpowers (`brainstorming`, `writing-plans`, TDD, review) |
| Why is it like this? | SuperProj (`DECISIONS.md`) |
| What did we knowingly leave undone? | SuperProj (`FOLLOWUPS.md`) |
| What should we do differently next time? | SuperProj (`LESSONS.md`) |
| Where was the thread dropped? | SuperProj (`JOURNAL.md`) |

Superpowers' `docs/plans/` files stay exactly where they are. SuperProj links to
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
preference to running `sp.js status`, which cannot be stale.

## Tooling

Never hand-count IDs or dates. Use the engine:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" status          # full rollup (markdown)
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" status --json    # same, machine-readable, includes nextIds
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" state            # regenerate STATE.md (writes only if changed)
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" check            # validate; exit 1 on errors
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" next-id D        # next free ID for F|D|U|L|R|M
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" today            # date stamp, do not guess it
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" init             # scaffold a missing ledger (idempotent)
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

1. **Intent lives in the ledger, truth lives in git.** When they disagree, stop and reconcile with `/superproj:resume` before doing new work.
2. **Append-only files are append-only.** `DECISIONS.md`, `LESSONS.md`, `JOURNAL.md`: add at the bottom, never rewrite history. Change your mind with a new entry that links back.
3. **One feature `in-progress` per worktree.** Park or finish before starting another.
4. **Acceptance criteria before plan.** A feature with no verifiable criteria is not ready to be planned, and cannot be closed.
5. **Decide in the moment.** A decision recorded at the end of a session has already lost the alternatives that made it interesting.
6. **No trigger, no follow-up.** If you cannot name the condition that makes deferred work urgent, drop it rather than pretend it is tracked.
7. **Done means verified.** Acceptance criteria ticked with evidence — not "code written", not "tests pass locally, probably".
8. **The ledger ships with the code.** Update it in the same commit as the work it describes, or immediately after. Never leave it dirty at the end of a session.

## Router

| Situation | Skill |
|---|---|
| New project, from a PRD or from an idea | `/superproj:kickoff` |
| Fresh session, or back after a break | `/superproj:resume` |
| "Where are we?" | `/superproj:status` |
| About to build the next thing | `/superproj:start-feature` |
| That thing is built and reviewed | `/superproj:finish-feature` |
| A non-obvious choice just got made | `/superproj:decide` |
| Something is being deliberately left undone | `/superproj:followup` |
| Something surprised us or cost too much | `/superproj:lesson` |
| Milestone's features are all done | `/superproj:milestone-review` |
| Scope changed, priorities moved, requirement added | `/superproj:roadmap` |

## Working with a ledger present

Before starting any implementation work, check the roadmap for the feature it
belongs to. Work that matches no feature is either a follow-up, a bug (which
gets a feature row if it is not trivial), or scope creep that needs
`/superproj:roadmap` first. Say so rather than quietly building it.

Ledger files use `merge=union` in `.gitattributes` so parallel worktrees append
without conflicts. That can produce duplicate IDs after a merge — `sp.js check`
catches them; fix by renumbering the *newer* entry.
