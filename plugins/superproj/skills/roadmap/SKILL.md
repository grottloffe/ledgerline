---
name: roadmap
description: Change the plan of record — add or cut requirements and features, re-sequence work, split or merge features, or reprioritise a milestone. Use when new requirements arrive mid-project, when something on the roadmap turns out to be unnecessary or bigger than thought, when priorities shift, or when work is requested that no existing feature covers.
when_to_use: Trigger on "can we also add", "actually we don't need", "this is more important now", "let's do X before Y", "split this up", or when asked to build something that maps to no feature on the roadmap.
argument-hint: [what is changing]
---

# Updating the roadmap

The roadmap is allowed to change — that is the point of writing it down rather
than guessing. What is not allowed is changing quietly.

## 1. Classify the change

| Change | Needs |
|---|---|
| New requirement | `R-` row in `PRD.md`, feature(s) to deliver it, decision entry |
| Cut requirement | Move to the PRD's Cut table, drop dependent features, decision entry |
| New feature for an existing requirement | Roadmap row; no decision needed |
| Re-sequencing only | Roadmap edit and a journal line; no decision needed |
| Feature turned out to be two | Split, redistribute acceptance criteria, keep both IDs traceable to the original |
| Feature no longer needed | `dropped` with the reason in the milestone notes |

Scope changes need a decision entry. Sequence changes do not. The distinction
matters: decisions are for things a future reader will not be able to infer.

## 2. Push back first, if it is warranted

Before writing anything down, say what the change costs — this is more useful to
the user than compliance:

- Which milestone does this land in, and what does it push out?
- Does it conflict with a `must` already committed to, or with a recorded decision? Name the ID.
- Does it invalidate work in flight? If a feature is `in-progress` and this changes its criteria, stop that feature first rather than moving the target mid-build.
- Is this actually a follow-up (small, deferrable, trigger-shaped) rather than a roadmap item?
- If the roadmap has grown twice without anything being cut, say so. Roadmaps that only accumulate stop being plans.

Then make the change the user wants. Being the one who names the cost is the job;
being the one who refuses is not.

## 3. Apply it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" next-id F      # or R, or M
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" check
```

- New IDs from the script — never reuse a dropped one.
- Keep dependencies honest, including any new ones this creates for existing features.
- Map every new feature to a requirement.
- Create dossiers only for features in the current or next milestone.
- Update `PRD.md` open questions if this settles or raises one.
- Journal entry: what changed, why, what it displaced.

## 4. Report

The diff in plain terms: what was added, what moved, what got dropped, and what
the current milestone now contains. If the change pushed a `must` requirement
past the last milestone, lead with that.
