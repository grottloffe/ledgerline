---
name: decide
description: Record an architectural or technical decision in the project's append-only decision log, with the options that were considered and the consequences accepted. Use the moment a non-obvious choice is made — a library or service picked over an alternative, a schema or API shape settled, a tradeoff accepted, a constraint discovered, or a deliberate decision not to do something.
when_to_use: Trigger on "let's go with", "we decided", "use X instead of Y", "for now we'll", "log this decision", or immediately after choosing between real alternatives during design or implementation.
argument-hint: [what was decided]
---

# Logging a decision

Write it now, while the alternatives are still in your head. A decision recorded
next week records only the winner, which is the least useful part.

## What qualifies

Record it if a competent person joining the project would ask "why is it like
this?" — a dependency chosen over a real alternative, a data model or protocol
shape, a boundary drawn, a performance or security tradeoff accepted, a
deliberate omission ("no caching until we measure"), a constraint discovered the
hard way ("the API rate-limits at 10/s, so everything downstream is batched").

Do not record: naming, formatting, or anything the code states plainly. If the
entry would read "we used the standard approach", skip it. A decision log that
records everything gets read as often as one that records nothing.

## Write it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" next-id D
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" today
```

Append to `docs/project/DECISIONS.md` — at the bottom, never rewriting an
existing entry:

```markdown
### D-0NN — <the decision, as a statement not a question>

- **Date:** YYYY-MM-DD
- **Status:** accepted
- **Context:** what forced a choice here. The constraint or problem, not the history of the conversation.
- **Options considered:**
  - <option> — <why it was plausible, and what killed it>
  - <option> — <same>
- **Decision:** what we are doing.
- **Consequences:** what this costs us, what it now makes hard, what has to be true for it to keep working. Be honest here; this section is the one that earns its keep.
- **Revisit when:** the observable condition that should make us reopen this.
- **Links:** F-0NN, plan file, PR, issue, or the doc that convinced us.
```

At least two options, and the rejected one stated fairly. "Option B: worse" is
not a record of anything — if there was genuinely no alternative, it was a
constraint, so write it as one.

## Then

- Add the ID to the feature dossier's "Decisions made here" table.
- If it changes the stack, module map, or an invariant, update `ARCHITECTURE.md` and reference the ID.
- If it changes scope, it also needs `/superproj:roadmap`.

## Changing your mind later

Never edit the old entry. Append the new decision, and mark the old one
`superseded by D-0NN`. The pair — what we believed, then what changed — is worth
more than either alone, and is the only way to avoid relitigating the same
question every few months.
