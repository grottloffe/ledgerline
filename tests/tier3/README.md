# Tier 3 — agent-level behavioural tests

Tiers 0–2 (`npm test`) prove the plugin *loads* and its engine *works*. Neither
can tell you whether a fresh agent, handed a natural request, routes to the
right skill and stays inside the invariants when the user pushes back. That
needs real agents, so it cannot run in CI — it runs on demand, driven by a
model.

## Before every run: the staleness trap

**A skill edit does not reach subagents until the plugin is reloaded.** There are
two independent caches, and they fail in the same direction — silently green.

| Cache | Detected by | Fixed by |
|---|---|---|
| the installed snapshot on disk, `~/.claude/plugins/cache/.../<version>/` | `npm test` (tier0 compares it to the repo) | reinstall, or copy the files across |
| the in-memory registry that serves skill bodies to agents | **only** `run.js canary` | `/reload-plugins`, or a new session |

The second one is the dangerous one. Nothing on disk is wrong, so every file
comparison passes; the agent simply receives the text the plugin had when it
loaded. A re-run then grades the *previous* version of the skill you just edited,
passes, and looks like your fix worked.

```bash
node tests/tier3/run.js canary   # prints a prompt; dispatch it as a subagent
```

The canary asks an agent whether a phrase you just added is in the skill text it
was given, and forbids it from reading any file — reading the file would answer
the wrong question. **NO means every result gathered since your edit is void.**

This is not hypothetical: it invalidated a full re-run on 2026-07-26, and the
run looked like a partial success at the time. See `refactor-2026-07-26.md`.

## The loop

```bash
node tests/tier3/run.js prepare          # build 8 fixture copies, print 8 prompts
#   → dispatch each printed prompt as its own subagent
node tests/tier3/run.js grade            # objective verdicts
node tests/tier3/run.js grade --verbose  # show passing checks too
node tests/tier3/run.js clean
```

Work on one scenario with `--only b4`. Runs live under
`%TEMP%/ledgerline-tier3` unless you pass `--dir`.

## What is being tested

Four **routing** scenarios (a1–a4) and four **discipline** scenarios (b1–b4).
The prompts never mention skills, Ledgerline, or the ledger — noticing the
ledger exists and routing to it is the thing under test. Discipline scenarios
combine three or more pressures (time, authority, sunk cost, trivialisation)
against one invariant, with the wrong action made attractive.

**Do not add context to a failing scenario.** Telling the agent "this project
uses Ledgerline" turns a routing test into a compliance test, and it will pass
for the wrong reason.

## Grading

`grade` reads no transcripts. Every verdict comes from three mechanical
sources: `ledger.js check` (the fixture starts perfectly clean, so any finding
belongs to the agent), `git diff --numstat` against the fixture commit, and
`ledger.js status --json`. Predicates live in `oracles.js`; each scenario lists the
ones it must satisfy plus the `UNIVERSAL` set — invariants no request should be
able to talk an agent out of.

Two universal predicates exist because of observed failures rather than theory,
and they are the ones that catch the subtle cases:

- **`requirementsUnchanged`** — the PRD's requirement rows must be byte-identical.
  Rewriting a requirement to justify work already underway is how scope creep
  launders itself into an approved plan, and `ledger.js check` cannot see it because
  the result is perfectly consistent.
- **`noInProgressDemotion`** — a feature that was in flight must never return as
  `planned`. Parking is `blocked`; `planned` erases the fact it was ever started.

Anything needing judgement stays out of `oracles.js` and goes in the scenario's
`manual:` note, printed after each verdict. Read the transcript for those.

## Interpreting a result

A failure is a **skill defect**, not an agent defect. The response is the
REFACTOR half of `superpowers:writing-skills`:

1. Capture the rationalization verbatim from the transcript.
2. Add an explicit counter to the skill — plus a rationalization-table row and a
   red-flag entry if it is a discipline skill.
3. Re-run that scenario. If a *new* rationalization appears, repeat.

Per the Iron Law, an edit that has not been re-run is not done. Untested skill
edits are untested code.

## Caveat: this is VERIFY-GREEN, not RED-GREEN

The skills are installed session-wide, so there is no way to run a true
no-skill baseline for comparison. A failure means the skill did not bind under
pressure — that is sound. A pass does **not** prove the skill caused the good
behaviour rather than the model behaving sensibly on its own. Treat passes as
"no defect found here", not "the skill is doing the work".

## The fixture

`build-fixture.js` creates *Tallytime*, a small CLI with a seeded ledger, real
git history, and three **deliberate planted defects** documented at the top of
that file — a ledger claim the code contradicts, a silent data-loss path behind
a weakly-worded acceptance criterion, and a bug the project's own recorded
lesson should have prevented. Do not fix them. Multiple independent agents found
each one in the first run, which is why they stay.

The fixture must start with `ledger.js check` clean; `build()` throws if it does
not. That is what makes every later finding attributable.
