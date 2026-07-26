---
name: start-feature
description: Open the next roadmap feature and hand it to the Superpowers build cycle. Verifies dependencies, writes acceptance criteria into the feature dossier, creates the worktree, then invokes brainstorming and writing-plans. Use when starting work on a feature, when asked "what's next, let's build it", or before writing any implementation code on a tracked project.
argument-hint: [F-0NN | feature name]
---

# Starting a feature

The gate between "we have a roadmap" and "we are writing code". Its job is to
make sure the thing about to be built is the right thing, is unblocked, and has
a definition of done that exists *before* anyone is emotionally invested in the
implementation.

## 1. Choose

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" status --json
```

If the user named a feature, use it. Otherwise take the `ready` list and
recommend one, with reasoning: dependency order first, then risk (build the
thing most likely to invalidate the design early), then value.

Refuse to start if:

- Something is already `in-progress` in this worktree. Finish or park it first. Parking is `blocked` with the reason in the roadmap row and a status log line in the dossier — never `planned`, which claims the work never began and throws away the criteria progress. Leave every unticked criterion exactly as it is.
- Parking it would trade a higher priority for a lower one. Requirement priority outranks whatever is nearest to hand: if the parked feature serves a `must` and the new one a `should` or `could`, say that plainly and let the user choose. Do not settle it by starting.
- Dependencies are not `done`. Say which, and offer to start that instead.
- The feature maps to no requirement. That is scope creep → `/superproj:roadmap`, and that skill stops for agreement before anything gets built. Do not route through it and carry on in the same turn.
- An open question in `PRD.md` blocks it. Resolve the question first; building
  past an unresolved question is how you get work that has to be thrown away.

## 2. Define done, then commit to it

Open the dossier (create from `${CLAUDE_PLUGIN_ROOT}/templates/FEATURE.md` if
absent, named `docs/project/features/F-0NN-<slug>.md`).

Write the acceptance criteria **now**, with the user. Each one:

- Verifiable by running or looking at something specific.
- About observable behaviour, not implementation ("a signed-out user visiting /app lands on /login", not "add an auth middleware").
- Includes the unhappy paths that matter, and the non-functional ones that apply (a `must` on latency or accessibility belongs here, or it will never be checked).

Also fill in the out-of-scope list. Reviews drift without it.

Get explicit agreement on the criteria before continuing. This is the single
highest-leverage minute in the whole cycle.

## 3. Open the work

Set status `in-progress` in both `ROADMAP.md` and the dossier, add a status log
line, and **record where the work will land** — the branch name or worktree path,
written into the dossier. Decide it once, here, from what the repo already does:
if recent history shows feature branches merging in, make one; if history is
linear on the default branch, work there. `finish-feature` reads this line
instead of guessing, which is the whole reason it is worth a sentence.

Use the Superpowers `using-git-worktrees` skill for isolation if the project
works that way, and note the worktree path in the dossier so the next session can
find it.

## 4. Hand to Superpowers

In order, invoking each skill properly rather than paraphrasing it:

1. `superpowers:brainstorming` — only if the *approach* is genuinely open. If the dossier's design notes already settle it, skip and say why; running a Socratic loop on a settled question wastes a session.
2. `superpowers:writing-plans` — produces `docs/plans/YYYY-MM-DD-<feature>.md`. Feed it the acceptance criteria and the relevant `ARCHITECTURE.md` invariants, plus any `LESSONS.md` rules that apply to this kind of work. That last one is why lessons are written down at all — go and read them.
3. Link the plan path into the dossier and the roadmap row.
4. `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute.

If Superpowers is not installed, say so plainly and fall back to writing a
plan yourself in the same location and format — but recommend installing it.

## 5. During the build

Two things stay live while implementing:

- A non-obvious choice gets made → `/superproj:decide`, in the moment.
- Something gets deliberately skipped → `/superproj:followup`, with a trigger.

Do not batch these to the end of the session. The context that makes them worth
recording is gone by then.
