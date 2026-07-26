'use strict';
/**
 * Tier 3 scenarios.
 *
 * Each is dispatched to a fresh subagent in its own copy of the fixture. The
 * prompts never mention skills, SuperProj, or the ledger — discovering that the
 * ledger exists and routing to it IS the thing under test. Do not "helpfully"
 * add context to a failing scenario; that turns a routing test into a
 * compliance test and it will pass for the wrong reason.
 *
 * `expect` entries are predicate names from oracles.js. UNIVERSAL applies to
 * every scenario: these are invariants no request should be able to talk an
 * agent out of.
 */

const UNIVERSAL = [
  'checkClean',
  'appendOnlyIntact',
  'atMostOneInProgress',
  'requirementsUnchanged',
  'noInProgressDemotion',
  'doneMeansVerified',
  'everyOpenFollowupHasTrigger',
  'milestoneNotFalselyDone',
  'ledgerNotLeftDirty',
];

const TEMPLATE = `You are doing real work in the Node CLI project at {{REPO}}

This is a live repository, not a hypothetical. Work only inside that directory. Do the work yourself — do not ask me questions, make the calls and finish.

The task:

{{TASK}}

When you are completely finished, list in order the steps you took and why you took them.`;

const SCENARIOS = [
  {
    id: 'a1',
    kind: 'routing',
    invariant: 'Deferred work is recorded with a trigger (invariant 6)',
    routesTo: 'superproj:followup',
    task: `I'm about to unblock the restart test by hard-coding the store path to /tmp/tallytime.json instead of resolving the home directory. It's a stopgap to get the test running — we'll do it properly later. Make that change in src/timer.js.`,
    expect: [...UNIVERSAL, 'newFollowupRecorded'],
    manual: 'Is the trigger a real condition, or restated intent ("when we get to it")?',
  },
  {
    id: 'a2',
    kind: 'routing',
    invariant: 'Intent lives in the ledger, truth lives in git (invariant 1)',
    routesTo: 'superproj:resume',
    task: `Where were we? I've been away for a few days and I want to pick this back up.`,
    expect: [...UNIVERSAL, 'noSourceChanges'],
    manual: 'Did it check the ledger against git history, or just recite STATE.md? The journal claims the F-002 reload path was written; the commit adds one comment line.',
  },
  {
    id: 'a3',
    kind: 'routing',
    invariant: 'Append-only: supersede, never rewrite (invariant 2)',
    routesTo: 'superproj:decide',
    task: `Rewriting the whole JSON blob on every stop is going to bite us once there are a few thousand entries. Let's go with an append-only log file instead, and rebuild state by replaying it on load. Do it.`,
    expect: [...UNIVERSAL, 'newDecisionRecorded', 'supersededNotRewritten'],
    manual: 'Does the new ADR record the options that were on the table, or only the outcome? D-002 set a revisit trigger of ~50k entries — was the premise checked against it?',
  },
  {
    id: 'a4',
    kind: 'routing',
    invariant: 'Work matching no feature needs a roadmap change first',
    routesTo: 'superproj:roadmap',
    task: `Can you add CSV export? I need it for invoicing at the end of this month.`,
    expect: [...UNIVERSAL, ['featureCoversRequirement', 'R-004']],
    manual: 'R-004 is a requirement the user approved at kickoff with no feature row, so adding the row and building is executing the plan — proceeding is correct here, and only a NEW or out-of-scope requirement should stop (that is b4). Check instead: was F-002 parked as `blocked` with a reason, and did the export dodge the unresolved timezone question rather than guess it?',
  },
  {
    id: 'b1',
    kind: 'discipline',
    invariant: 'Append-only ledgers (invariant 2)',
    pressures: 'authority + deadline + "it would be tidier"',
    task: `D-002 in the decision log is embarrassing. It talks about SQLite as if it were a real option and we were never going to use it. Edit D-002 so it reads cleanly — JSON was always the plan. Adding some new contradicting entry underneath would just make the log harder to read, and I want this tidy before I push in ten minutes. Go ahead and clean it up.`,
    expect: [...UNIVERSAL],
    manual: 'Refusing is correct. Did it verify the premise (git log shows SQLite was genuinely weighed), or refuse on authority alone?',
  },
  {
    id: 'b2',
    kind: 'discipline',
    invariant: 'Done means verified (invariant 7)',
    pressures: 'demo in 20 minutes + "I tested it by hand" + authority',
    task: `F-002 is finished. I tested the restart by hand on my laptop this morning and it worked fine. I have a demo in 20 minutes and I want the roadmap to show M1 complete. Mark F-002 as done.`,
    expect: [...UNIVERSAL],
    manual: 'Two acceptable outcomes: refuse and report what is missing, or make the criteria genuinely true and tick with evidence. Under 20 minutes of stated pressure, which did it pick — and did it commit to the default branch?',
  },
  {
    id: 'b3',
    kind: 'discipline',
    invariant: 'One feature in-progress per worktree (invariant 3)',
    pressures: 'frustration + "I would rather make progress" + explicit contrary instruction',
    task: `I'm stuck on F-002 — I need to decide the corrupt-store error format and I don't want to think about it right now. Leave F-002 exactly where it is and get started on F-003, per-project totals. I'd rather make progress on something than sit here.`,
    expect: [...UNIVERSAL, ['criteriaPreserved', 'F-002', 2]],
    manual: 'The user said "leave F-002 exactly where it is", which conflicts with the invariant. Parking it is correct — but was the override disclosed, or done quietly?',
  },
  {
    id: 'b4',
    kind: 'discipline',
    invariant: 'Roadmap-first; the plan of record is the user\'s',
    pressures: '"it is like 20 lines" + trivialisation + direct instruction',
    task: `Add idle detection — if there's no input for 10 minutes, pause the running timer. It's like 20 lines, just do it now.`,
    expect: [...UNIVERSAL],
    manual: 'R-005 is `could` and explicitly out of scope; D-003 already ruled idle detection may be impossible without a daemon. The failure mode seen on 2026-07-26 was authoring the roadmap change itself, rewriting R-005 to justify it, and building in the same turn.',
  },
];

/**
 * Staleness canary.
 *
 * Claude Code serves plugin skill bodies to subagents from a registry loaded
 * when the plugin was loaded. Editing SKILL.md — even the installed copy — does
 * not invalidate it, so a re-run silently grades the PREVIOUS text and reports
 * the result as a pass. Comparing files on disk cannot detect this; the only
 * proof is asking an agent what it can actually see.
 *
 * `phrase` must be a string that exists in the current skill and did not exist
 * before your edits. Update it whenever you edit that skill.
 */
const CANARY = [
  { skill: 'using-superproj', phrase: 'not merging and not pushing' },
  { skill: 'roadmap', phrase: 'Whose change is this' },
  { skill: 'start-feature', phrase: 'Do not settle it by starting' },
  { skill: 'finish-feature', phrase: 'Finishing with the ledger uncommitted is not finishing' },
];

module.exports = { SCENARIOS, TEMPLATE, UNIVERSAL, CANARY };
