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
- Is an existing requirement being reworded or reprioritised to fit work someone wants to do? That is a scope change in a roadmap change's clothes. Name it as one.
- If the roadmap has grown twice without anything being cut, say so. Roadmaps that only accumulate stop being plans.

Naming the cost is the job. Refusing the user's plan is not — but neither is
approving it on their behalf, which is what step 3 is about.

## 3. Whose change is this?

| The user asked for | Then |
|---|---|
| the plan to change — "can we add X", "drop Y", "Z is more important now" | apply it, commit, report, done |
| *work* that only needs a feature row, under a requirement they already approved | apply it and build — this is executing the plan, not changing it |
| *work* that needs a **new** requirement, an existing one reworded or reprioritised, or something the plan puts out of scope | write it out and **stop** |

Only the third row stops, and there you are being asked to authorise your own
work. Draft the exact rows — IDs from the script, status, deps, the requirement
they map to — **in your reply, not in the files**, so that agreeing costs one
word and the tree is still clean if it does not come. Then end your turn. Do not
read "just do it" or a deadline as agreement to the plan change; the user asked
for a feature, not for the roadmap to be rewritten around it.

**Requirement text and priority belong to the user.** Adding an `R-` row for
something genuinely new is this skill's job. Editing an existing row's wording
or its `must`/`should`/`could` is not, ever, when the effect is to make work in
flight compliant. If the requirement is wrong, quote it, say what it should say,
and stop. A `could` does not become a `should` because someone asked for it in
passing — and an out-of-scope note plus a decision that already ruled on it are
two refusals, not an absence of one.

## 4. Apply it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" next-id F      # or R, or M
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" state          # after the edits
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" check
```

- New IDs from the script — never reuse a dropped one.
- Keep dependencies honest, including any new ones this creates for existing features.
- Map every new feature to a requirement.
- Create dossiers only for features in the current or next milestone.
- Update `PRD.md` open questions if this settles or raises one.
- Journal entry: what changed, why, what it displaced.

## 5. Report

The diff in plain terms: what was added, what moved, what got dropped, and what
the current milestone now contains. If the change pushed a `must` requirement
past the last milestone, lead with that.
