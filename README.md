# Ledgerline

A Claude Code plugin that gives a project **memory** — layered on top of
[Superpowers](https://github.com/obra/superpowers), not replacing it.

Superpowers is excellent at building one feature well: brainstorm, plan, execute
with subagents, TDD, review, merge. What it deliberately does not do is remember
anything between features. Every cycle starts from a blank page, so across weeks
of work nothing tracks what is left, what was decided, what was knowingly left
undone, or what went wrong last time.

Ledgerline is that missing layer.

| Question | Answered by |
|---|---|
| What are we building, and why? | Ledgerline — `PRD.md` |
| What next, and what blocks it? | Ledgerline — `ROADMAP.md` |
| How do we build *this one thing* well? | **Superpowers** |
| Why is it like this? | Ledgerline — `DECISIONS.md` |
| What did we knowingly leave undone? | Ledgerline — `FOLLOWUPS.md` |
| What should we do differently? | Ledgerline — `LESSONS.md` |
| Where was the thread dropped? | Ledgerline — `JOURNAL.md` |

## Install

This repository is both a marketplace and the plugin. From Claude Code:

```
/plugin marketplace add C:\Code\Ledgerline
/plugin install ledgerline@ledgerline-marketplace
/reload-plugins
```

Install at **user** scope so it is available in every project. The plugin itself
holds no project data — each project keeps its own ledger in its own repo.

Verify:

```
/plugin list
/ledgerline:status
```

Superpowers should also be installed. Ledgerline works without it — it will fall
back and say so — but the handoffs are the point.

## The 30-second version

```
/ledgerline:kickoff path/to/PRD.md     # or just describe the idea
/ledgerline:start-feature              # picks the next unblocked feature, hands it to Superpowers
   …Superpowers builds it…
/ledgerline:finish-feature             # verifies, harvests decisions/follow-ups/lessons, journals
/ledgerline:status                     # where are we
/ledgerline:resume                     # next session: reconcile ledger against git, then continue
/ledgerline:milestone-review           # when a milestone closes: verify, learn, re-plan
```

A `SessionStart` hook injects a short status brief into every session, so Claude
already knows where the project stands before you type anything.

## What lands in your project

```
docs/
├── plans/                  ← Superpowers' plans, untouched
└── project/                ← the Ledgerline ledger
    ├── STATE.md            GENERATED — ~60 lines, where we are right now
    ├── PRD.md              what and why; requirements with stable IDs (R-001)
    ├── ARCHITECTURE.md     living map: stack, module map, invariants, undecided
    ├── ROADMAP.md          milestones (M1) → features (F-001), status + deps
    ├── DECISIONS.md        append-only ADRs (D-001)
    ├── FOLLOWUPS.md        deferred work, each with a trigger (U-001)
    ├── LESSONS.md          append-only, each ending in a rule (L-001)
    ├── JOURNAL.md          one entry per work session
    ├── features/           per-feature dossiers: criteria, status log, verification
    └── reviews/            milestone reviews
```

Plain markdown, committed with the code, diffable in review. `init` also adds
`merge=union` to `.gitattributes` for the append-only files so parallel
worktrees do not conflict on every entry.

### STATE.md

One screen you can open without starting Claude: current milestone and its exit
criteria, what is in flight with its unverified acceptance criteria, **what needs
a decision from you**, what is blocked, what is ready, the debt register, and the
last three journal entries.

It is derived, never authoritative. Three things keep that safe:

- The `SessionStart` hook regenerates it, so it does not depend on anyone remembering.
- It is written **only when the content actually changed**, so opening a session does not dirty your working tree.
- `check` regenerates and compares, so a stale *or* hand-edited STATE.md is reported rather than silently trusted or silently destroyed.

Committed, so `git log -p docs/project/STATE.md` is a readable history of where
the project stood over time. If you would rather not have it in git, add it to
`.gitignore` — nothing depends on it being tracked.

## Skills

| Command | What it does |
|---|---|
| `/ledgerline:kickoff` | PRD intake or Socratic idea → PRD, architecture, roadmap |
| `/ledgerline:resume` | Reconcile ledger against git, rebuild context, propose next action |
| `/ledgerline:status` | Where we are, what is blocked, what is ready, debt position |
| `/ledgerline:start-feature` | Gate + acceptance criteria, then hand off to Superpowers |
| `/ledgerline:finish-feature` | Verify with evidence, harvest knowledge, close, journal |
| `/ledgerline:decide` | Record a decision with its alternatives and consequences |
| `/ledgerline:followup` | Register deferred work with a trigger condition |
| `/ledgerline:lesson` | Record a lesson that ends in an actionable rule |
| `/ledgerline:milestone-review` | Verify exit criteria, assess debt and estimates, re-plan |
| `/ledgerline:roadmap` | Scope changes, re-sequencing, splits, cuts |
| `ledgerline:using-ledgerline` | The contract Claude reads before touching the ledger |

Plus a read-only `ledgerline:ledgerline-auditor` agent that cross-checks the
ledger against the repository and reports drift with evidence.

`decide`, `followup` and `lesson` are written to trigger **automatically** when
Claude notices a decision being made or work being deferred — that is what keeps
the ledger honest without you policing it.

## The engine

One dependency-free node script does all mechanical work, so Claude never
hand-counts IDs or guesses dates:

```
node <plugin>/scripts/ledger.js status [--brief|--json]
node <plugin>/scripts/ledger.js state          # regenerate STATE.md, write-if-changed
node <plugin>/scripts/ledger.js check          # validate; exit 1 on errors
node <plugin>/scripts/ledger.js next-id D      # F|D|U|L|R|M
node <plugin>/scripts/ledger.js init           # idempotent scaffold
node <plugin>/scripts/ledger.js today
```

`check` catches duplicate IDs, more than one feature in flight, features marked
done with unchecked acceptance criteria, roadmap/dossier status conflicts,
dependencies on features that do not exist, missing plan files, orphaned plans,
follow-ups with no trigger, dangling supersede references, a stale journal while
work is in flight, and a STATE.md that no longer matches the ledger.

## Design notes

See [DESIGN.md](DESIGN.md) for why it is shaped this way, the invariants it
enforces, and where to extend it.

## Editing the plugin

Skill body changes take effect immediately. Changes to `hooks/hooks.json`,
`agents/`, or the scripts need `/reload-plugins` or a restart. Bump `version` in
both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` when you
want an install to pick up changes as an update.

## Licence

MIT.
