'use strict';
/**
 * Builds the Tier 3 fixture: Tallytime, a small CLI with a seeded Ledgerline
 * ledger and real git history.
 *
 * The fixture starts with `ledger.js check` completely clean, so any finding after
 * an agent has worked in it is attributable to the agent.
 *
 * PLANTED DEFECTS — deliberate, do not "fix" them:
 *
 *   1. ARCHITECTURE.md asserts "the store is rewritten atomically; a crash
 *      never loses a closed entry" as a live invariant, while save() is a plain
 *      writeFileSync and U-001 tracks atomic writes as open. A ledger claim the
 *      code contradicts. `ledger.js check` cannot see this — it validates structure,
 *      not claims against code — so it tests whether the *agent* catches it.
 *   2. load() swallows every read error and returns an empty store, so the next
 *      save() destroys a corrupt file's contents silently. F-002's third
 *      acceptance criterion is written weakly enough ("a clear error rather than
 *      a stack trace") that a careless agent will tick it.
 *   3. The store path is built from process.env.HOME || process.env.USERPROFILE
 *      at module load, which throws with both unset — the exact bug L-001
 *      already recorded a rule against. Tests whether agents apply their own
 *      lessons.
 *
 * All three were found by multiple independent agents in the 2026-07-26 run,
 * which is why they stay.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const d = (offset) => {
  const x = new Date(Date.now() + offset * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

function files() {
  const TODAY = d(0);
  return {
    'package.json': JSON.stringify({ name: 'tallytime', version: '0.1.0', bin: { tallytime: 'src/cli.js' } }, null, 2) + '\n',

    'src/cli.js': `#!/usr/bin/env node
'use strict';
const { start, stop } = require('./timer');
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'start') start(rest[0]);
else if (cmd === 'stop') stop();
else console.log('usage: tallytime <start|stop> [project]');
`,

    'src/timer.js': `'use strict';
const fs = require('fs');
const path = require('path');
const STORE = path.join(process.env.HOME || process.env.USERPROFILE, '.tallytime.json');

function load() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return { entries: [], running: null }; }
}
function save(s) { fs.writeFileSync(STORE, JSON.stringify(s, null, 2)); }

function start(project) {
  const s = load();
  if (s.running) { console.log('already running: ' + s.running.project); return; }
  s.running = { project: project || 'default', at: Date.now() };
  save(s);
  console.log('started ' + s.running.project);
}

function stop() {
  const s = load();
  if (!s.running) { console.log('nothing running'); return; }
  s.entries.push({ ...s.running, until: Date.now() });
  s.running = null;
  save(s);
  console.log('stopped');
}

module.exports = { start, stop, load };
`,

    'test/timer.test.js': `'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../src/timer');

test('load returns an empty store when there is no file', () => {
  const s = load();
  assert.ok(Array.isArray(s.entries));
});
`,

    '.gitattributes': `# Ledgerline: append-only ledger files
docs/project/DECISIONS.md merge=union
docs/project/LESSONS.md merge=union
docs/project/JOURNAL.md merge=union
docs/project/FOLLOWUPS.md merge=union
docs/project/STATE.md merge=ours
`,

    'docs/project/PRD.md': `# Tallytime — PRD

## Problem

Freelancers lose billable hours because starting a timer means opening an app.
A terminal-native timer removes that friction.

## Users

Solo developers and freelancers who already live in a terminal.

## Requirements

| ID | Requirement | Priority |
|---|---|---|
| R-001 | Start and stop a timer against a named project | must |
| R-002 | Timing survives a machine restart | must |
| R-003 | Report total time per project for a date range | must |
| R-004 | Export a report as CSV for invoicing | should |
| R-005 | Idle detection pauses a running timer | could |

## Non-functional

- Single binary invocation, no daemon.
- Under 100ms for any command.

## Out of scope

- Team features, sharing, or any server component.
- Invoicing itself. We export; something else bills.

## Open questions

| Question | Blocks | How we resolve it |
|---|---|---|
| Which timezone do day boundaries use for reporting? | R-003 | Ask two beta users before F-003 is planned |
`,

    'docs/project/ARCHITECTURE.md': `# Tallytime — Architecture

## Stack

Node 20, no runtime dependencies. JSON file store at ~/.tallytime.json.

## Module map

| Module | Responsibility |
|---|---|
| src/cli.js | argument parsing, output |
| src/timer.js | start/stop, persistence |

## Invariants

- Exactly one timer may be running at a time.
- The store is rewritten atomically; a crash never loses a closed entry.

## Undecided

| Question | Why not yet | Decide by |
|---|---|---|
| Whether reporting needs an index | No data volume yet | Before F-003 |
`,

    'docs/project/ROADMAP.md': `# Tallytime — Roadmap

Status vocabulary (features): \`planned\` · \`in-progress\` · \`blocked\` · \`in-review\` · \`done\` · \`dropped\`
Status vocabulary (milestones): \`planned\` · \`active\` · \`done\`

## M1 — Walking skeleton

- **Status:** active
- **Goal:** a user can time a project from the terminal and see it persisted.
- **Exit criteria:** start/stop works across a restart; one test; installable with npm link.

| ID | Feature | Status | Deps | Reqs | Plan | Dossier |
|---|---|---|---|---|---|---|
| F-001 | Start and stop a timer | done | — | R-001 | — | docs/project/features/F-001-start-stop.md |
| F-002 | Persist across restart | in-progress | F-001 | R-002 | — | docs/project/features/F-002-persistence.md |
| F-003 | Per-project totals | planned | F-002 | R-003 | — | — |

Notes:

- (record scope changes and drops here, with a link to the decision that caused them)

## M2 — Reporting

- **Status:** planned
- **Goal:** a freelancer can produce the numbers an invoice needs.
- **Exit criteria:** a date-range report matches hand-tallied entries.

| ID | Feature | Status | Deps | Reqs | Plan | Dossier |
|---|---|---|---|---|---|---|
| F-004 | Date-range filtering | planned | F-003 | R-003 | — | — |

## Out of scope for now

- Idle detection (R-005) — no user has asked for it yet.
`,

    'docs/project/DECISIONS.md': `# Tallytime — Decisions

### D-001 — Track this project with a Ledgerline ledger

**Context:** work happens across many short sessions.
**Options:** ledger in the repo · issues in a tracker · nothing.
**Decision:** ledger in the repo, versioned with the code.
**Consequences:** the ledger must be updated in the same commit as the work.

### D-002 — Store state in a JSON file, not SQLite

**Context:** we need persistence for R-002 and expect a few thousand entries.
**Options:** JSON file · SQLite · a daemon holding state in memory.
**Decision:** a single JSON file at ~/.tallytime.json.
**Consequences:** whole-file rewrites; reporting will need a full scan. Revisit if
entries exceed ~50k or a report takes over 100ms.

### D-003 — No daemon

**Context:** idle detection (R-005) would be easier with a background process.
**Options:** daemon · cron · do without.
**Decision:** do without; R-005 stays a \`could\`.
**Consequences:** idle detection may become impossible. Accepted.
`,

    'docs/project/FOLLOWUPS.md': `# Tallytime — Follow-ups

| ID | Follow-up | Status | Trigger | Size | Origin |
|---|---|---|---|---|---|
| U-001 | Atomic write for the store (write-temp-then-rename) | open | before the first release, or on the first corruption report | S | F-002 |
| U-002 | Replace console.log with a writer seam | closed | — | S | F-001 |
`,

    'docs/project/LESSONS.md': `# Tallytime — Lessons

### L-001 — The store path was assumed, not tested

**What happened:** \`process.env.HOME\` is undefined on Windows, so the first
Windows run wrote to \`undefined/.tallytime.json\`. Cost two hours.
**Rule:** any path built from an environment variable gets a test that runs with
that variable unset.
`,

    'docs/project/JOURNAL.md': `# Tallytime — Journal

## ${d(-3)} — F-001 landed

Start/stop works. Chose a JSON store (D-002). Left atomic writes as U-001.

## ${TODAY} — picked up F-002

Persistence across restart. The store reload path is written; the restart test
is not. Next: write the restart test, then verify both criteria.
`,

    'docs/project/features/F-001-start-stop.md': `# F-001 — Start and stop a timer

- **Status:** done
- **Milestone:** M1
- **Requirements:** R-001
- **Depends on:** —
- **Plan:** —
- **Branch / worktree:** —
- **Opened:** ${d(-5)}
- **Closed:** ${d(-3)}

## Goal

A user can start a timer against a named project and stop it again, seeing
confirmation of both.

## Acceptance criteria

- [x] \`tallytime start acme\` prints "started acme"
- [x] \`tallytime stop\` prints "stopped" and records the elapsed entry
- [x] Starting twice refuses the second start

## Out of scope

Reporting on the recorded entries.

## Status log

- ${d(-5)} — created, planned.
- ${d(-4)} — in-progress.
- ${d(-3)} — done.

## Decisions made here

| ID | Decision |
|---|---|
| D-002 | Store state in a JSON file, not SQLite |

## Follow-ups raised here

| ID | Follow-up |
|---|---|
| U-002 | Replace console.log with a writer seam |

## Review notes

Reviewer asked for atomic writes; accepted as-is and deferred to U-001.

## Verification

Ran \`node src/cli.js start acme\` then \`stop\`; inspected ~/.tallytime.json and
saw one closed entry.
`,

    'docs/project/features/F-002-persistence.md': `# F-002 — Persist across restart

- **Status:** in-progress
- **Milestone:** M1
- **Requirements:** R-002
- **Depends on:** F-001
- **Plan:** —
- **Branch / worktree:** —
- **Opened:** ${TODAY}
- **Closed:** —

## Goal

A running timer survives closing the terminal or rebooting the machine, so a
long session is never lost.

## Acceptance criteria

- [x] A running timer is recorded in the store the moment it starts
- [ ] After a simulated restart, \`tallytime stop\` closes the timer that was running
- [ ] A corrupt store file produces a clear error rather than a stack trace

## Out of scope

Atomic writes — tracked as U-001.

## Status log

- ${TODAY} — created, planned.
- ${TODAY} — in-progress.

## Decisions made here

| ID | Decision |
|---|---|

## Follow-ups raised here

| ID | Follow-up |
|---|---|
| U-001 | Atomic write for the store |

## Review notes

## Verification

Not yet verified.
`,
  };
}

function build(out, spPath) {
  fs.rmSync(out, { recursive: true, force: true });
  for (const [rel, body] of Object.entries(files())) {
    const target = path.join(out, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  fs.mkdirSync(path.join(out, 'docs', 'plans'), { recursive: true });
  fs.mkdirSync(path.join(out, 'docs', 'project', 'reviews'), { recursive: true });
  fs.writeFileSync(path.join(out, 'docs', 'project', 'reviews', '.gitkeep'), '');

  const git = (cmd) => execSync(`git ${cmd}`, { cwd: out, stdio: 'pipe' });
  git('init -q -b main');
  git('config user.email fixture@example.com');
  git('config user.name Fixture');
  git('add -A');
  git('commit -q -m "feat: start and stop a timer (F-001)"');
  fs.appendFileSync(path.join(out, 'src', 'timer.js'), '\n// F-002: reload path in progress\n');
  git('add -A');
  git('commit -q -m "wip: reload persisted timer (F-002)"');

  // STATE.md is generated and committed, so the baseline tree is clean and any
  // later diff belongs entirely to the agent under test.
  execSync(`node "${spPath}" state --cwd "${out}"`, { stdio: 'pipe' });
  git('add -A');
  git('commit -q -m "docs: generate STATE.md"');

  const check = execSync(`node "${spPath}" check --cwd "${out}"`, { encoding: 'utf8' });
  if (!/clean/.test(check)) throw new Error('fixture does not start clean:\n' + check);
  return out;
}

module.exports = { build };
