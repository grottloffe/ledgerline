---
name: finish-feature
description: Close out a feature — verify acceptance criteria with evidence, harvest decisions, follow-ups and lessons, update the architecture map and roadmap, and journal it. Use when a feature's implementation and review are complete, when about to merge a feature branch, or when asked to mark something done.
argument-hint: [F-0NN]
---

# Finishing a feature

Where the project's memory is actually made. Skipping this is what turns a
tracked project back into an untracked one — everything after this point depends
on someone having done it honestly.

## 1. Verify before believing

Walk the dossier's acceptance criteria one at a time and **check each one by
doing something**: run the command, hit the endpoint, look at the page. Record
in the Verification section what you ran and what you saw.

- Do not tick a box you did not verify.
- A criterion that turns out to be unverifiable was badly written: fix the wording, then verify, and note the correction as a lesson if it happened more than once.
- Any criterion that fails: the feature is not done. Say so and go back. This is the invariant the whole system rests on.

Confirm review happened (`superpowers:requesting-code-review` /
`receiving-code-review`) and that the test suite passes — from a clean checkout,
not from a shell that has been running for three hours. If Superpowers is not
installed, review the diff yourself against the acceptance criteria and the
`ARCHITECTURE.md` invariants, and say that a proper review skill was not
available.

## 2. Harvest

Read the session and the diff for things worth keeping. This is deliberate
recall, not a formality — ask yourself each question:

| Question | Where it goes |
|---|---|
| What did we choose that a reasonable person would have chosen differently? | `/ledgerline:decide` |
| What did we leave undone, stub out, or hard-code? | `/ledgerline:followup` |
| What surprised us, or cost more than it should have? | `/ledgerline:lesson` |
| Did the shape of the system change — new module, new boundary, new invariant, a decision from the "Undecided" table now settled? | `ARCHITECTURE.md` |
| Did we learn something that changes a *later* feature's plan? | note it in that feature's dossier now, while you know it |

Include TODO comments left in the diff — either they become follow-ups with IDs,
or they get deleted. A TODO with no follow-up is a lie.

## 3. Close

- Dossier: status `done`, closed date, status log line, verification filled in, review notes recorded (including findings deliberately accepted, and why).
- `ROADMAP.md`: status `done`.
- If this was the last feature of the milestone, say so and offer `/ledgerline:milestone-review`.
- `JOURNAL.md`: one entry — worked on, landed, decisions, follow-ups, lessons, next, state of the tree.

## 4. Land it

The dossier records where this work lives (`start-feature` step 3). Commit there
— ledger and code together, so they land as one change. If the dossier says
nothing, follow what the repo's recent history does rather than inventing a
scheme, and write down which you picked.

Use `superpowers:finishing-a-development-branch` for the merge/PR decision, or if
it is unavailable, ask whether this merges or becomes a PR and do that.

**Finishing with the ledger uncommitted is not finishing.** `git status` must be
clean before you report — an uncommitted ledger is the one state `ledger.js check`
calls healthy and git says never happened, and it is invisible in exactly the
session that would have caught it.

Regenerate and validate before you call this finished:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" state
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" check
```

Fix anything `check` reports.

## 5. Report

Two or three sentences: what now works that did not before, what it cost in
debt, and the next candidate. Then stop — the next feature is the user's call,
and a fresh feature deserves a fresh look at priorities rather than momentum.
