---
name: kickoff
description: Start a new project under SuperProj tracking, from an existing PRD document or from a rough idea. Produces the PRD, initial architecture, and a dependency-ordered roadmap of milestones and features, then hands the first feature to Superpowers. Use when starting an application from scratch, when handed a PRD or spec to build, or when adopting SuperProj in a repo that has no docs/project/ ledger.
argument-hint: [path-to-PRD | short description of the idea]
disable-model-invocation: true
---

# Project kickoff

Turning "build me X" into a roadmap someone can execute against for weeks.
Expect this to take a while. Do not rush to the roadmap: a roadmap built on
unexamined requirements produces confident work on the wrong thing.

## 0. Refuse to overwrite

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" paths
```

If a ledger already exists, stop. Say so, and offer `/superproj:resume` or
`/superproj:roadmap` instead. Kickoff runs once per project.

## 1. Establish the source of truth

**If given a PRD, spec, or design doc:** read all of it before commenting. Then
interrogate it. You are looking for the things documents habitually omit:

- Requirements with no acceptance signal — how would anyone know this was met?
- "Fast", "simple", "secure", "scalable" used as if they were specifications.
- Missing non-functionals entirely: data volume, concurrency, privacy, offline, backup, who operates it.
- Unstated assumptions about the environment: auth provider, hosting, existing systems to integrate with.
- Scope that is described but not bounded — no statement of what is *not* included.
- Conflicts between two sections that both sound reasonable.

Raise these as a numbered list of specific questions, worst first. Use
`AskUserQuestion` for the ones with a small set of plausible answers; ask in prose
for the open ones. Do not proceed on assumptions you invented — mark genuinely
undecidable ones as open questions in the PRD and note what they block.

**If given only an idea:** invoke the Superpowers `brainstorming` skill
(`superpowers:brainstorming`, or `brainstorming` if the namespace differs) and
let it do the Socratic work. Come back here with its output. If Superpowers is
not installed, do it yourself: one question at a time, cheapest-to-answer first,
until you can state the problem, the users, and the outcome without hedging.

## 2. Write the ledger

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" init --name "<project name>"
```

Then fill in, in this order:

**`PRD.md`** — problem, users, outcome, requirements with `R-` IDs and acceptance
signals, non-functionals, explicit out-of-scope, open questions. Every
requirement gets a priority (`must`/`should`/`could`). If everything is a `must`,
you have not prioritised; push back.

**`ARCHITECTURE.md`** — only what is actually decided. Put everything else in the
"Undecided" table with a reason and a decide-by point. An honest three-line
architecture beats an invented one; the temptation here is to fill in a stack you
were never asked to choose.

**`DECISIONS.md`** — one entry per foundational choice made during this
conversation, with the options that were on the table. Language, framework, data
store, deploy target, and any explicit non-choice ("we deliberately do not add
auth yet"). This is the cheapest decisions will ever be to capture.

## 3. Decompose

Milestones are **thin vertical slices of working software**, not layers. "Auth,
then API, then UI" is wrong — nothing works until the end. M1 is always a
walking skeleton: the thinnest path that runs end to end, deployed, with one
test and one command to run it locally.

For each milestone: a goal, and exit criteria that can be checked.

Features inside a milestone:

- Each maps to at least one `R-` requirement. A feature mapping to nothing is scope creep — challenge it or add the requirement.
- Each is small enough to plan and land in one or two sessions. Anything vaguer than that is really a milestone.
- Dependencies are explicit, and are real (`F-005` needs `F-003`'s schema), not habitual ordering.
- Every requirement of priority `must` is covered by some feature before the last milestone. Check this and say which milestone each `must` lands in.

Write the rows into `ROADMAP.md`. Create a dossier from
`${CLAUDE_PLUGIN_ROOT}/templates/FEATURE.md` for the first two or three features
only — writing acceptance criteria for M4 now is fiction, and it invites the
roadmap to rot.

## 4. Ground it

- Add `.gitattributes` union-merge lines if `init` did not (it prints what it wrote).
- Commit the ledger as its own commit: `docs: initialise project ledger`.
- Append a `JOURNAL.md` entry: what was decided, what is open, what is next.
- Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" check` and fix everything it reports.

## 5. Hand off

Present, briefly: the milestone list with goals, the count of features and how
`must` requirements are covered, the open questions that still block something,
and the first feature you propose to build with its acceptance criteria.

Then stop and let the user react. Do not start building in the same turn —
kickoff's output is a plan to disagree with, and the disagreement is worth more
before code exists than after. When they agree, `/superproj:start-feature`.
