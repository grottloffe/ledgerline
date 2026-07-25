---
name: lesson
description: Record a lesson learned during development, ending in an actionable rule for future work. Use when something took far longer than expected, when a bug class recurred, when an estimate was badly wrong, when a debugging session went down a dead end, or when an assumption about a library, API or the domain turned out to be false.
when_to_use: Trigger on "that took way longer than expected", "I keep making this mistake", "we should have known", "next time let's", "that was the wrong approach", or during a retrospective or feature close-out.
argument-hint: [what we learned]
---

# Capturing a lesson

A lesson that does not change future behaviour is a diary entry. Every entry
here ends in a rule, and the rule is the part that gets read.

## Worth recording

- A bug that took disproportionately long — especially if the *cause* of the delay was a wrong assumption rather than difficulty.
- The same review comment appearing a third time.
- An estimate wrong by more than 2×, in either direction.
- A debugging path that led nowhere, and the signal that should have redirected it sooner.
- A library, API or platform behaving differently than assumed.
- A process step that was skipped and cost something — or one that was followed and clearly saved something.

## Write it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/sp.js" next-id L
```

Append to `docs/project/LESSONS.md`, at the bottom:

```markdown
### L-0NN — <the rule, compressed into a title>

- **Date:** YYYY-MM-DD
- **Kind:** process | technical | estimation | tooling | product
- **What happened:** one or two sentences. Concrete.
- **Why:** the root cause. Not "we were careless" — what specifically made the wrong thing look right?
- **Rule going forward:** one imperative sentence a future session can act on without reading the story.
- **Applied to:** what you actually changed as a result — a skill, CLAUDE.md, a template, a checklist — or "nothing yet".
- **Links:** F-0NN, commit, issue.
```

Test the rule: could a fresh session follow it without context? "Be more careful
with migrations" fails. "Run migrations against a copy of production data before
merging" passes.

## Close the loop

A lesson filed and never applied is worse than none — it creates the feeling of
learning without the effect. So:

- If the rule belongs in the build cycle, propose adding it to `ARCHITECTURE.md` invariants, `CLAUDE.md`, or a project skill, and say so in **Applied to**.
- If it should change how features get planned, mention it in `/superproj:start-feature` (that skill reads `LESSONS.md` before planning — make sure your rule is findable there).
- If three lessons point the same direction, that is a signal about the process, not the code. Say so during `/superproj:milestone-review`.

Do not soften the entry to protect anyone's feelings, including your own. An
edited-for-comfort lessons file teaches nothing.
