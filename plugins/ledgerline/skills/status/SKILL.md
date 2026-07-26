---
name: status
description: Report where the project stands — current milestone, what is in flight, what is blocked, what is ready to start, open follow-ups, and any ledger inconsistencies. Use when asked "where are we", "what's left", "how is the project going", "what's next", or when you need project state before deciding what to work on.
---

# Project status

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ledger.js" status
```

No ledger? Say so once and offer `/ledgerline:kickoff`. Do not improvise a status
report from git log — that answers a different question.

Then report, in prose, in this order:

1. **Where we are** — milestone, its goal, features done out of total.
2. **In flight** — what is `in-progress` or `in-review`, and its plan file.
3. **Blocked** — what, and on what. Name the thing that would unblock it.
4. **Next** — the unblocked candidates, with your recommendation and one sentence of reasoning.
5. **Debt** — open follow-ups whose trigger has plausibly fired. Read the triggers and judge; the script cannot.
6. **Problems** — anything from the ledger check, in plain language, with what you propose to do about it.

The script gives you counts. Your job is the reading of them: whether the
project is converging or spreading, whether debt is accumulating faster than it
is being paid, whether the same feature has been in flight for suspiciously
long. Say that part out loud — it is the reason to ask a person rather than run
a script.

Keep it to a short paragraph per section. If the user asked a narrow question
("is F-011 done?"), answer just that.
