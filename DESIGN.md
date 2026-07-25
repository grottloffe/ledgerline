# SuperProj — design notes

Why the plugin is shaped this way, what it deliberately does not do, and where to
change it. Read this before extending it.

## The problem being solved

Superpowers optimises a single feature's lifecycle, and it does that well. Its
unit of work is one cycle: brainstorm, plan, execute, review, merge. State that
matters *within* a cycle lives in `docs/plans/` and `.superpowers/sdd/`, and both
are consumed and finished with.

That design has a consequence. Anything whose lifetime is longer than one cycle
has nowhere to live:

- The order of work, and what is blocked on what.
- Why the schema looks like that, and what was rejected.
- The hard-coded value someone meant to come back to.
- The fact that the last three estimates were 3× low.
- Where the thread was dropped two weeks ago.

In practice this leaks into the human. You remember the roadmap, so you become
the bottleneck and the single point of failure. The agent starts every session
uninformed and confidently rebuilds context from the code, which tells it what
exists but never what was intended.

SuperProj adds the longer-lived layer and nothing else. Every temptation to
duplicate Superpowers' cycle was refused.

## Shape

**A ledger of markdown files in the repo.** Alternatives considered and why they lost:

- *CLAUDE.md sections* — always in context, but unstructured, unbounded, and they rot silently.
- *Issue tracker* — good at tasks, poor at decisions and lessons, and off-disk, so it drifts from the code and needs a network round trip to read.
- *JSON or SQLite* — queryable and rigorous, but the user cannot skim it in a PR diff, and the agent needs a tool call for every read. Markdown is natively readable by both parties, which is the whole game.

The cost of markdown is fuzzy parsing. That is paid for with strict column
orders, ID conventions, and `sp.js check` — a validator, rather than a schema.

**One generated file, treated as hostile.** `STATE.md` exists for two audiences
the rest of the ledger does not serve: a human opening the repo without starting
Claude, and `git log -p`, which turns it into a history of where the project
stood. It is explicitly *not* for the agent — the agent gets the SessionStart
brief for free and can regenerate on demand, so for it a file on disk can only
ever be staler than a live query.

That framing matters, because derived data committed to git has a predictable
failure mode: it becomes the most prominent and most trusted file in the ledger,
and it is the one guaranteed to be wrong. "Never hand-edit" is also the rule most
likely to be broken, since it is the most convenient file to edit — and a hand
edit silently destroyed on the next regeneration is worse than no file at all.

So the safety is structural rather than a request for discipline. The hook
regenerates it, so freshness does not depend on anyone remembering. It is written
only when the content actually changed, so opening a session does not dirty the
tree — without that, the churn objection alone would kill the idea. And `check`
regenerates and compares, so stale-or-hand-edited is a reported warning instead
of a silent lie. The rule is enforced by the validator, not by the documentation.

**A script for everything mechanical.** ID allocation, date stamps, rollups and
validation go through `sp.js`. Language models are unreliable at exactly these
things: counting to the next free ID across seven files, knowing today's date,
noticing that two features are in flight. Every one of those is now deterministic,
which means the skills can be about judgement instead of bookkeeping.

**A hook for the thing you cannot rely on the model to choose.** The
`SessionStart` hook injects a ~700-character brief. Not because the model cannot
read the ledger, but because it will not always think to, and a session that
starts uninformed makes its first decision uninformed. The hook is silent when
there is no ledger, silent during compaction, and silent on any error — a hook
that breaks session startup is worse than no hook.

**Skills that trigger themselves for capture, and only for capture.**
`decide`, `followup` and `lesson` are model-invocable with trigger phrases in
their descriptions ("let's go with", "for now", "that took way longer than
expected"). These are the entries that are worthless if written later, because
the alternatives and the reasoning are gone by then. `kickoff` is
`disable-model-invocation: true` — it rewrites the project's foundation and
should never fire on inference.

## Invariants, and why each one exists

1. **Intent in the ledger, truth in git.** Gives every drift question a
   deterministic answer instead of an argument.
2. **Append-only files are append-only.** The pair "what we believed, then what
   changed" is the valuable artifact. Editing history destroys it and invites
   relitigating settled questions.
3. **One feature in flight per worktree.** Two half-features is the most common
   way a small project stops converging.
4. **Acceptance criteria before the plan.** Criteria written after the
   implementation describe the implementation. Written before, they describe the
   requirement — and they are cheap to argue about while nothing is built.
5. **Decide in the moment.** See above.
6. **No trigger, no follow-up.** A register everything goes into is one nobody
   reads. The trigger requirement forces the "is this real?" question at entry
   time, which is the only time it is cheap.
7. **Done means verified with evidence.** The one claim the whole system rests
   on. If `done` can mean "code written", the ledger is decoration.
8. **The ledger ships with the code.** Same commit, same review, same history.

## Handoff points to Superpowers

SuperProj never reimplements a Superpowers skill; it calls them:

| SuperProj | calls | Superpowers |
|---|---|---|
| `kickoff` (idea path) | → | `brainstorming` |
| `start-feature` | → | `brainstorming`, `writing-plans`, `using-git-worktrees`, then `subagent-driven-development` / `executing-plans` |
| `finish-feature` | → | `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch` |

`docs/plans/` stays Superpowers' territory. SuperProj links to plan files from
roadmap rows and dossiers, and flags orphans, but never writes them.

One interesting feedback loop: `start-feature` reads `LESSONS.md` before planning
and feeds applicable rules into `writing-plans`. That is what makes lessons
change behaviour rather than accumulate. If you extend anything, extend that.

## Concurrency

Superpowers encourages parallel worktrees, which means several checkouts editing
the same ledger files. Two mitigations:

- `.gitattributes` sets `merge=union` on the four append-only files, so parallel
  appends both survive instead of conflicting on every entry.
- Union merge can produce duplicate IDs, so `sp.js check` treats duplicates as an
  error and the convention is to renumber the *newer* entry.

`ROADMAP.md` is not union-merged, because a union merge of a status table
produces nonsense rows. Status edits are expected to conflict occasionally and
be resolved by hand — the roadmap is small and the conflicts are legible.

`STATE.md` uses `merge=ours`, since merging two versions of a generated file is
meaningless: keep either side and let the next regeneration produce the truth.

## What was deliberately left out

- **A fully autonomous driver** that walks the roadmap without stopping. The gates in `start-feature` and `finish-feature` are where a wrong direction gets caught for the price of a conversation instead of a milestone. Easy to add later on top of these skills; hard to un-add safely.
- **Time tracking and burndown.** Estimation accuracy is assessed per milestone from real ratios, which is the part that changes behaviour. Hours logged is data nobody acts on.
- **Templates per project type** (web app, CLI, library). Would help, but shipping one honest set beats four half-maintained ones. Add by copying `templates/` and pointing `init` at a variant.
- **MCP server.** Nothing here needs a persistent process or network access, and a script is inspectable and debuggable in a way a server is not.

## Extending it

- **New ledger file:** add the template, add it to `LEDGER_FILES` in `sp.js`, give it a parser and at least one rule in `check()`. A ledger file with no validation rule will rot.
- **New STATE.md section:** add it in `generateState()`, and cap it with the `cap()` helper so truncation is visible as "+N more" rather than silent. Keep the whole file around 60 lines: its value is being skimmable in one screen, and every section added competes with the ones already earning their place.
- **New status value:** `STATUSES` in `sp.js`, plus the vocabulary lists in `using-superproj` and the templates. Three places, all greppable.
- **New skill:** keep the body short — skill content stays in context for the whole turn once loaded. State what to do, not why. Push reference material into a sibling file the skill points at.
- **Project-type variants:** copy `templates/`, add a `--template` flag to `init`.

## Known weak points

- Markdown table parsing is convention-bound. Reorder the columns in `ROADMAP.md` and the parser reads the wrong cells. `check` catches the resulting nonsense (bad statuses, unknown deps) but the error message will point at the symptom.
- Requirement-to-feature coverage is only verified at milestone review and by the auditor agent, not continuously. A `must` requirement can sit uncovered for a while before anything complains.
- The follow-up "trigger has fired" judgement cannot be automated and depends on someone actually reading the register during reviews. This is the most likely part to be quietly skipped, and therefore the part to watch.
