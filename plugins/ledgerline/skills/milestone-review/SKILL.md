---
name: milestone-review
description: Run an end-of-milestone review — verify exit criteria and requirement coverage against the PRD, assess estimation accuracy and debt position, roll lessons up into rules, revisit decisions whose conditions have fired, and re-plan the next milestone. Use when a milestone's features are all done, or when the roadmap needs re-grounding in what has actually been learned.
argument-hint: [M0]
---

# Milestone review

The point where the plan gets corrected by contact with reality. A project that
never does this executes a roadmap written by someone who knew less than you do
now.

## 1. Gather

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" status --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" check
git log --oneline <last-milestone-tag>..HEAD
```

Read every dossier in the milestone, the journal entries covering it, and the
decisions and lessons filed during it. For a large milestone, dispatch the
`ledgerline:ledgerline-auditor` agent to do the coverage cross-check while you
read the narrative material.

Start a review doc from `${CLAUDE_PLUGIN_ROOT}/templates/MILESTONE-REVIEW.md` at
`docs/project/reviews/<M0>-review.md`.

## 2. Verify the milestone, not the features

The features were verified individually at close. What has *not* been checked is
whether they add up to the milestone's exit criteria — the integration nobody
owned.

- Walk each exit criterion and check it end to end, as a user would. Feature-level green does not imply milestone-level working.
- Cross-check requirement coverage: every `R-` requirement the milestone claimed, actually delivered. Where a requirement was partially met, say precisely which part.
- List `must` requirements still open and where they now land. If a `must` has slipped twice, that is a finding about the plan, not the requirement.

## 3. Assess honestly

**Estimation.** Expected versus actual per feature, with the ratio. Look for the
pattern rather than the outliers — consistently 2× means the decomposition is
too coarse, not that everyone is slow.

**Debt.** Open follow-ups at the start versus the end. Read every trigger and
decide: fired, not yet, or drop it. Growing debt with fired triggers is the
strongest signal available that the next milestone should be a hardening one,
and it is the one teams most reliably ignore.

**Decisions.** Any whose "revisit when" condition has fired. For each: still
right, or superseded? Do this now, while there is a reason to look.

**Lessons.** Group them. Three lessons pointing the same way is a process
finding — turn it into a change to a skill, template or `CLAUDE.md`, not a fourth
lesson.

**What went well.** Name it specifically enough to repeat deliberately.

## 4. Re-plan

With what you now know, rewrite the next milestone rather than merely accepting
it:

- Features that turned out unnecessary → `dropped`, with the reason.
- Features that turned out to be two things → split them.
- Newly obvious work → added, mapped to requirements.
- Re-sequence for what you learned about real dependencies.

Any change to *scope* — not sequence — needs a decision entry. Silent scope
change is how a project ends up somewhere nobody chose.

## 5. Close

- Mark the milestone `done` in `ROADMAP.md`, set the next one `active`.
- Journal entry summarising the review and the re-plan.
- Tag the commit (`git tag <M0>-complete`) so the next review has a boundary.
- Run `ledger.js state`, then `check`, and clear it.

Report to the user: what the milestone actually delivered versus what it
promised, the two or three findings that matter, and what changed about the plan
as a result. Lead with anything uncomfortable — a review that only contains good
news was not a review.
