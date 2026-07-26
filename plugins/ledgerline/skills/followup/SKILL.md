---
name: followup
description: Record deliberately deferred work in the project's follow-up register, with the trigger condition that makes it urgent. Use whenever something is skipped, stubbed, hard-coded, or postponed — missing tests, error handling left out, a TODO in the diff, hardening or performance work put off until later.
when_to_use: Trigger on "for now", "we'll fix that later", "TODO", "good enough for the moment", "not handling that case yet", "hard-coded for now", or when a review finding is accepted rather than fixed.
argument-hint: [what is being deferred]
---

# Capturing a follow-up

Deferring work is fine. Deferring it invisibly is not — that is how a codebase
acquires surprises.

## Write it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" next-id U
```

Add a row to `docs/project/FOLLOWUPS.md`:

| Field | What goes in it |
|---|---|
| ID | `U-0NN` |
| Title | The work, phrased as an action: "validate webhook signatures" |
| Status | `open` |
| Trigger | The observable condition that makes this urgent |
| Size | `S` (< 1h) · `M` (a session) · `L` (needs its own feature row) |
| Origin | The feature, review, or decision it came from |

Add a Detail section for anything that needs more than a line: exactly what was
skipped, where the stub is, and what done looks like.

## The trigger is the whole point

A trigger is a condition someone could notice: "before the first external user",
"when a second tenant is added", "when this table passes 100k rows", "when we
next touch this module", "if error rate exceeds 1%".

"Later", "when we have time", and "soon" are not triggers. If you cannot name a
condition, then either this is genuinely worth doing now, or it is not worth
tracking. Say which, and drop it if it is the latter. An honest register of
twelve items gets read; a register of two hundred does not.

## Size L means it is not a follow-up

If it needs its own feature row, put it on the roadmap via `/ledgerline:roadmap`
and reference the feature from the follow-up. The register is for small
deliberate gaps, not for hiding real work.

## Keep it honest

- A TODO comment in code without a `U-` ID next to it should either get one or be deleted.
- Closing a follow-up means setting `closed` and saying where it was done — not deleting the row.
- Follow-ups whose trigger has fired are surfaced by `/ledgerline:status`, but only a person reading the triggers can tell. Do that reading during `/ledgerline:milestone-review`.
