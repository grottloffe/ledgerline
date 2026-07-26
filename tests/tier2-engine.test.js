'use strict';
/**
 * Tier 2a — integration tests for sp.js against real ledgers on disk.
 *
 * Everything runs the CLI in a throwaway repo, because the CLI is what the
 * skills actually invoke. The negative fixtures matter most: every skill ends
 * with "run check and fix what it reports", so a check that silently passes a
 * broken ledger makes that instruction decorative.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  makeRepo, makeLedgerRepo, validLedger, dossier,
  readFile, mutate, spRun, findings, TODAY,
} = require('./helpers');

const LEDGER_FILES = [
  'PRD.md', 'ARCHITECTURE.md', 'ROADMAP.md',
  'DECISIONS.md', 'FOLLOWUPS.md', 'LESSONS.md', 'JOURNAL.md',
];

// ------------------------------------------------------------------- init

test('init scaffolds a complete ledger', () => {
  const dir = makeRepo();
  const res = spRun(dir, 'init', '--name', 'Demo');
  assert.equal(res.status, 0, res.out);

  for (const f of LEDGER_FILES) {
    assert.ok(readFile(dir, `docs/project/${f}`), `init did not write ${f}`);
  }
  assert.ok(fs.existsSync(path.join(dir, 'docs/project/features/.gitkeep')));
  assert.ok(fs.existsSync(path.join(dir, 'docs/project/reviews/.gitkeep')));
  assert.ok(fs.existsSync(path.join(dir, 'docs/plans')));
  // The skills promise STATE.md always exists; init generates it up front.
  assert.ok(readFile(dir, 'docs/project/STATE.md'), 'init did not generate STATE.md');
});

test('init substitutes every placeholder it promises to', () => {
  const dir = makeRepo();
  spRun(dir, 'init', '--name', 'Weather Machine');
  for (const f of LEDGER_FILES) {
    const text = readFile(dir, `docs/project/${f}`);
    assert.doesNotMatch(text, /\{\{[A-Z_]+\}\}/, `${f} still contains an unsubstituted placeholder`);
  }
  assert.match(readFile(dir, 'docs/project/PRD.md'), /Weather Machine/);
});

test('init writes the union-merge gitattributes the contract depends on', () => {
  const dir = makeRepo();
  spRun(dir, 'init');
  const ga = readFile(dir, '.gitattributes');
  for (const f of ['DECISIONS.md', 'LESSONS.md', 'JOURNAL.md', 'FOLLOWUPS.md']) {
    assert.ok(ga.includes(`docs/project/${f} merge=union`), `.gitattributes missing union merge for ${f}`);
  }
  assert.ok(ga.includes('docs/project/STATE.md merge=ours'), 'generated STATE.md should not be merged');
});

test('init preserves an existing .gitattributes', () => {
  const dir = makeRepo({ '.gitattributes': '*.png binary\n' });
  spRun(dir, 'init');
  assert.match(readFile(dir, '.gitattributes'), /\*\.png binary/);
  assert.match(readFile(dir, '.gitattributes'), /merge=union/);
});

test('init is idempotent and never clobbers real content', () => {
  const dir = makeRepo();
  spRun(dir, 'init');
  fs.writeFileSync(path.join(dir, 'docs/project/PRD.md'), '# Hand-written PRD\n');

  const second = spRun(dir, 'init');
  assert.equal(second.status, 0, second.out);
  assert.match(second.stdout, /left alone:.*PRD\.md/);
  assert.equal(readFile(dir, 'docs/project/PRD.md'), '# Hand-written PRD\n');
});

test('init --force overwrites', () => {
  const dir = makeRepo();
  spRun(dir, 'init');
  fs.writeFileSync(path.join(dir, 'docs/project/PRD.md'), '# Hand-written PRD\n');
  spRun(dir, 'init', '--force');
  assert.notEqual(readFile(dir, 'docs/project/PRD.md'), '# Hand-written PRD\n');
});

// -------------------------------------------------------------- happy path

test('a well-formed ledger checks completely clean', () => {
  const dir = makeLedgerRepo();
  const f = findings(dir);
  assert.equal(f.status, 0, f.stdout);
  assert.deepEqual(f.errors, [], 'unexpected errors');
  assert.deepEqual(f.warnings, [], 'unexpected warnings');
});

test('a freshly scaffolded ledger has no errors, only warnings', () => {
  // An empty ledger is incomplete, not wrong: kickoff must not start with a
  // check that fails.
  const dir = makeRepo();
  spRun(dir, 'init', '--name', 'Demo');
  const f = findings(dir);
  assert.equal(f.status, 0, `a fresh ledger should not fail check:\n${f.stdout}`);
  assert.deepEqual(f.errors, []);
  assert.ok(f.warnings.length > 0, 'a fresh ledger should warn that it is empty');
});

test('template placeholder IDs are not counted, but seeded real ones are', () => {
  // The negative lookahead in idHeadings/idRows is what keeps `### L-0NN` in a
  // template from being read as lesson L-0. DECISIONS.md deliberately ships one
  // genuine entry (D-001, "track this project with a SuperProj ledger"), so a
  // fresh project starts at D-002 — that asymmetry is the thing worth pinning.
  const dir = makeRepo();
  spRun(dir, 'init');
  const json = JSON.parse(spRun(dir, 'status', '--json').stdout);

  assert.equal(json.counts.lessons, 0, 'L-0NN placeholder was mistaken for a lesson');
  assert.equal(json.counts.features, 0, 'F-0NN placeholder was mistaken for a feature');
  assert.equal(json.counts.requirements, 0, 'R-0NN placeholder was mistaken for a requirement');
  assert.equal(json.counts.followupsOpen, 0, 'U-0NN placeholder was mistaken for a follow-up');
  assert.equal(json.counts.decisions, 1, 'the seeded D-001 should be a real decision');

  assert.equal(json.nextIds.L, 'L-001');
  assert.equal(json.nextIds.F, 'F-001');
  assert.equal(json.nextIds.R, 'R-001');
  assert.equal(json.nextIds.U, 'U-001');
  assert.equal(json.nextIds.D, 'D-002', 'the seeded decision must not be handed out twice');
});

// ---------------------------------------------------------------- next-id

test('next-id allocates above the highest existing entry', () => {
  const dir = makeLedgerRepo();
  assert.equal(spRun(dir, 'next-id', 'F').stdout.trim(), 'F-004');
  assert.equal(spRun(dir, 'next-id', 'D').stdout.trim(), 'D-002');
  assert.equal(spRun(dir, 'next-id', 'U').stdout.trim(), 'U-002');
  assert.equal(spRun(dir, 'next-id', 'L').stdout.trim(), 'L-002');
  assert.equal(spRun(dir, 'next-id', 'R').stdout.trim(), 'R-003');
  assert.equal(spRun(dir, 'next-id', 'M').stdout.trim(), 'M2');
});

test('next-id F also respects dossiers on disk that the roadmap forgot', () => {
  const dir = makeLedgerRepo({
    'docs/project/features/F-009-orphan.md': '# F-009 — Orphan\n\n- **Status:** dropped\n',
  });
  assert.equal(spRun(dir, 'next-id', 'F').stdout.trim(), 'F-010',
    'an ID already used by a dossier file must never be handed out again');
});

test('next-id rejects an unknown prefix', () => {
  const dir = makeLedgerRepo();
  const res = spRun(dir, 'next-id', 'Z');
  assert.equal(res.status, 2);
  assert.match(res.stderr, /usage/);
});

// ------------------------------------------------- negative fixtures: errors

/** Each case mutates the valid ledger in exactly one way and must be an error. */
const ERROR_CASES = [
  {
    name: 'duplicate IDs (the union-merge hazard)',
    mutate: (dir) => mutate(dir, 'docs/project/DECISIONS.md',
      (t) => t + '\n### D-001 — A conflicting decision merged in from another worktree\n'),
    expect: /Duplicate ID D-001/,
  },
  {
    name: 'two features in progress at once',
    mutate: (dir) => {
      mutate(dir, 'docs/project/ROADMAP.md', (t) => t.replace('| F-003 | Profile page | planned |', '| F-003 | Profile page | in-progress |'));
      fs.writeFileSync(path.join(dir, 'docs/project/features/F-003-profile.md'),
        dossier({ id: 'F-003', title: 'Profile page', status: 'in-progress', criteria: [[false, 'It renders']] }));
      mutate(dir, 'docs/project/ROADMAP.md', (t) => t.replace('| R-002 | — | — |\n', '| R-002 | — | docs/project/features/F-003-profile.md |\n'));
    },
    expect: /features are in-progress .*the limit is 1 per worktree/,
  },
  {
    name: 'a status outside the vocabulary',
    mutate: (dir) => mutate(dir, 'docs/project/ROADMAP.md', (t) => t.replace('| Profile page | planned |', '| Profile page | pending |')),
    expect: /F-003 has status "pending", which is not in the vocabulary/,
  },
  {
    name: 'a dependency on a feature that does not exist',
    mutate: (dir) => mutate(dir, 'docs/project/ROADMAP.md', (t) => t.replace('| Profile page | planned | F-002 |', '| Profile page | planned | F-042 |')),
    expect: /F-003 depends on F-042, which is not on the roadmap/,
  },
  {
    name: 'done with unverified acceptance criteria',
    mutate: (dir) => mutate(dir, 'docs/project/features/F-001-skeleton.md', (t) => t.replace('- [x] CI is green', '- [ ] CI is green')),
    expect: /F-001 is marked done but has 1 unchecked acceptance criteria/,
  },
  {
    name: 'roadmap and dossier disagree about status',
    mutate: (dir) => mutate(dir, 'docs/project/features/F-002-sign-in.md', (t) => t.replace('- **Status:** in-progress', '- **Status:** done')),
    expect: /F-002: roadmap says "in-progress", dossier says "done"/,
  },
  {
    name: 'in-flight feature with no dossier at all',
    mutate: (dir) => mutate(dir, 'docs/project/ROADMAP.md',
      (t) => t.replace('| — | docs/project/features/F-002-sign-in.md |', '| — | — |')),
    expect: /F-002 is in-progress but has no dossier file/,
  },
  {
    name: 'superseded by a decision that was never written',
    mutate: (dir) => mutate(dir, 'docs/project/DECISIONS.md', (t) => t.replace('**Consequences:**', '**Status:** superseded by D-007\n**Consequences:**')),
    expect: /superseded by D-007, which does not exist/,
  },
];

for (const c of ERROR_CASES) {
  test(`check fails on: ${c.name}`, () => {
    const dir = makeLedgerRepo();
    c.mutate(dir);
    const f = findings(dir);
    assert.equal(f.status, 1, `expected exit 1, got ${f.status}:\n${f.stdout}`);
    assert.ok(f.errors.some((e) => c.expect.test(e)),
      `no error matched ${c.expect}\ngot:\n${f.errors.map((e) => '  - ' + e).join('\n') || '  (none)'}`);
  });
}

// ----------------------------------------------- negative fixtures: warnings

const WARN_CASES = [
  {
    name: 'an open follow-up with no trigger',
    mutate: (dir) => mutate(dir, 'docs/project/FOLLOWUPS.md', (t) => t.replace('before the first release', '—')),
    expect: /U-001 is open with no trigger/,
  },
  {
    name: 'a hand-edited STATE.md',
    mutate: (dir) => mutate(dir, 'docs/project/STATE.md', (t) => t.replace(/^# .*/m, '# Everything is fine, actually')),
    expect: /STATE\.md is stale or was hand-edited/,
  },
  {
    name: 'a STATE.md that was never generated',
    mutate: (dir) => fs.rmSync(path.join(dir, 'docs/project/STATE.md')),
    expect: /STATE\.md has not been generated yet/,
  },
  {
    name: 'a missing ledger file',
    mutate: (dir) => fs.rmSync(path.join(dir, 'docs/project/LESSONS.md')),
    expect: /Ledger file LESSONS\.md is missing/,
  },
  {
    name: 'a plan document nothing links to',
    mutate: (dir) => fs.writeFileSync(path.join(dir, 'docs/plans/orphan-plan.md'), '# Orphan\n'),
    expect: /Plan docs\/plans\/orphan-plan\.md is not linked/,
  },
  {
    name: 'a roadmap row pointing at a plan that does not exist',
    mutate: (dir) => mutate(dir, 'docs/project/ROADMAP.md',
      (t) => t.replace('| — | docs/project/features/F-002-sign-in.md |', '| docs/plans/gone.md | docs/project/features/F-002-sign-in.md |')),
    expect: /references plan docs\/plans\/gone\.md, which does not exist/,
  },
  {
    name: 'work in flight behind a stale journal',
    mutate: (dir) => mutate(dir, 'docs/project/JOURNAL.md', (t) => t.replace(TODAY, '2020-01-01')),
    expect: /journal has not been touched in \d+ days/,
  },
];

for (const c of WARN_CASES) {
  test(`check warns (but does not fail) on: ${c.name}`, () => {
    const dir = makeLedgerRepo();
    c.mutate(dir);
    const f = findings(dir);
    assert.ok(f.warnings.some((w) => c.expect.test(w)),
      `no warning matched ${c.expect}\ngot:\n${f.warnings.map((w) => '  - ' + w).join('\n') || '  (none)'}`);
    assert.equal(f.status, 0, `a warning must not fail the check:\n${f.stdout}`);
  });
}

test('check reports a missing ledger as an error with a route out', () => {
  const dir = makeRepo();
  const res = spRun(dir, 'check');
  assert.equal(res.status, 1);
  assert.match(res.stdout, /No ledger found/);
  assert.match(res.stdout, /kickoff/, 'the error should say how to fix itself');
});

// ------------------------------------------------------------------- state

test('state is write-if-changed, so opening a session does not dirty the tree', () => {
  const dir = makeLedgerRepo();
  const stateFile = path.join(dir, 'docs/project/STATE.md');
  const before = fs.statSync(stateFile).mtimeMs;

  const res = spRun(dir, 'state');
  assert.equal(res.status, 0, res.out);
  assert.match(res.stdout, /unchanged/, 'a no-op regeneration must not rewrite the file');
  assert.equal(fs.statSync(stateFile).mtimeMs, before, 'STATE.md was rewritten despite no change');
});

test('state rewrites when the ledger actually moves', () => {
  const dir = makeLedgerRepo();
  mutate(dir, 'docs/project/ROADMAP.md', (t) => t.replace('| Profile page | planned |', '| Profile page | blocked |'));
  const res = spRun(dir, 'state');
  assert.match(res.stdout, /updated/);
  assert.match(readFile(dir, 'docs/project/STATE.md'), /## Blocked/);
});

test('STATE.md is stamped as generated and carries the current state', () => {
  const dir = makeLedgerRepo();
  const state = readFile(dir, 'docs/project/STATE.md');
  assert.match(state, /GENERATED FILE — DO NOT EDIT/);
  assert.match(state, /^Generated \d{4}-\d{2}-\d{2} \d{2}:\d{2}\.$/m);
  assert.match(state, /F-002 Sign in/, 'the in-flight feature should be named');
  assert.match(state, /1\/2 verified/, 'criteria progress should be reported');
  assert.match(state, /Check: clean/);
});

test('state --stdout prints without writing', () => {
  const dir = makeLedgerRepo();
  fs.rmSync(path.join(dir, 'docs/project/STATE.md'));
  const res = spRun(dir, 'state', '--stdout');
  assert.equal(res.status, 0);
  assert.match(res.stdout, /where we are/);
  assert.equal(readFile(dir, 'docs/project/STATE.md'), null, '--stdout must not write');
});

test('state on a repo with no ledger fails loudly', () => {
  const dir = makeRepo();
  const res = spRun(dir, 'state');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /No ledger/);
});

// ------------------------------------------------------------------ status

test('status --json exposes what the skills read off it', () => {
  const dir = makeLedgerRepo();
  const res = spRun(dir, 'status', '--json');
  assert.equal(res.status, 0, res.out);
  const json = JSON.parse(res.stdout);

  assert.equal(json.hasLedger, true);
  assert.equal(json.name, 'Demo');
  assert.equal(json.counts.features, 3);
  assert.equal(json.counts.done, 1);
  assert.equal(json.counts.requirements, 2);
  assert.equal(json.counts.followupsOpen, 1);
  assert.equal(json.activeMilestone.id, 'M1');
  assert.deepEqual(json.ready, [], 'F-003 depends on unfinished F-002, so nothing is ready');
  assert.deepEqual(json.findings, []);
  assert.equal(json.today, TODAY);
  assert.ok(json.nextIds.F && json.nextIds.D, 'nextIds is the whole reason skills call --json');
});

test('ready-to-start respects dependency order', () => {
  const dir = makeLedgerRepo();
  mutate(dir, 'docs/project/ROADMAP.md', (t) => t.replace('| Sign in | in-progress |', '| Sign in | done |'));
  mutate(dir, 'docs/project/features/F-002-sign-in.md',
    (t) => t.replace('- **Status:** in-progress', '- **Status:** done').replace('- [ ] A bad password', '- [x] A bad password'));
  const json = JSON.parse(spRun(dir, 'status', '--json').stdout);
  assert.deepEqual(json.ready, ['F-003'], 'F-003 should unblock once F-002 is done');
});

test('status --brief is the SessionStart payload and points at the contract skill', () => {
  const dir = makeLedgerRepo();
  const out = spRun(dir, 'status', '--brief').stdout;
  assert.match(out, /SuperProj ledger at docs\/project\//);
  assert.match(out, /project "Demo" \(1\/3 features done\)/);
  assert.match(out, /In flight: F-002 Sign in \[in-progress\]/);
  assert.match(out, /superproj:using-superproj/, 'the brief must route the model to the contract');
  assert.ok(out.length < 9000, 'the brief is injected into every session; keep it small');
});

test('status on a repo with no ledger explains itself instead of crashing', () => {
  const dir = makeRepo();
  const res = spRun(dir, 'status');
  assert.equal(res.status, 0);
  assert.match(res.stdout, /No SuperProj ledger found/);
  assert.match(res.stdout, /kickoff/);
});

// --------------------------------------------------------- discovery & CLI

test('the ledger is found from a nested subdirectory', () => {
  const dir = makeLedgerRepo();
  const deep = path.join(dir, 'src', 'app', 'components');
  fs.mkdirSync(deep, { recursive: true });
  const json = JSON.parse(spRun(deep, 'status', '--json').stdout);
  assert.equal(json.hasLedger, true);
  assert.equal(json.root, dir, 'the ledger root should be the repo, not the subdirectory');
});

test('flags work before or after the subcommand', () => {
  const dir = makeLedgerRepo();
  const { spawnSync } = require('child_process');
  const sp = path.join(__dirname, '..', 'plugins', 'superproj', 'scripts', 'sp.js');
  const before = spawnSync(process.execPath, [sp, '--cwd', dir, 'next-id', 'D'], { encoding: 'utf8', input: '' });
  const after = spawnSync(process.execPath, [sp, 'next-id', 'D', '--cwd', dir], { encoding: 'utf8', input: '' });
  assert.equal(before.stdout.trim(), 'D-002');
  assert.equal(after.stdout.trim(), 'D-002');
});

test('an unknown subcommand prints usage and exits 2', () => {
  const dir = makeLedgerRepo();
  const res = spRun(dir, 'frobnicate');
  assert.equal(res.status, 2);
  assert.match(res.stderr, /usage: node sp\.js/);
});

test('today emits both stamps the skills ask for', () => {
  const res = spRun(makeRepo(), 'today');
  assert.equal(res.status, 0);
  assert.match(res.stdout, /^date: \d{4}-\d{2}-\d{2}$/m);
  assert.match(res.stdout, /^datetime: \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m);
});

test('paths reports whether a ledger exists', () => {
  const withLedger = JSON.parse(spRun(makeLedgerRepo(), 'paths').stdout);
  assert.equal(withLedger.hasLedger, true);
  // kickoff refuses to run when this is true, so the false case has to be right.
  const without = JSON.parse(spRun(makeRepo(), 'paths').stdout);
  assert.equal(without.hasLedger, false);
  assert.ok(without.ledger.endsWith(path.join('docs', 'project')));
});

// ---------------------------------------------------------------- robustness

test('CRLF ledgers parse identically to LF ones', () => {
  // Windows checkouts with core.autocrlf=true produce these; every regex in
  // the engine has to tolerate the carriage return.
  const crlf = {};
  for (const [rel, body] of Object.entries(validLedger())) crlf[rel] = body.replace(/\n/g, '\r\n');
  const dir = makeLedgerRepo(crlf);

  const f = findings(dir);
  assert.deepEqual(f.errors, [], f.stdout);
  assert.deepEqual(f.warnings, [], f.stdout);
  const json = JSON.parse(spRun(dir, 'status', '--json').stdout);
  assert.equal(json.counts.features, 3);
  assert.equal(json.counts.decisions, 1);
});

test('a ragged roadmap table still parses', () => {
  // Models write markdown tables by hand; missing trailing pipes are routine.
  const dir = makeLedgerRepo();
  mutate(dir, 'docs/project/ROADMAP.md',
    (t) => t.replace('| F-003 | Profile page | planned | F-002 | R-002 | — | — |', '| F-003 | Profile page | planned | F-002 | R-002 | — | —'));
  const json = JSON.parse(spRun(dir, 'status', '--json').stdout);
  assert.equal(json.counts.features, 3);
  assert.equal(json.features[2].status, 'planned');
});

test('a corrupt ledger degrades instead of crashing', () => {
  const dir = makeLedgerRepo({ 'docs/project/ROADMAP.md': '# Roadmap\n\nnot a table at all\n' });
  for (const cmd of [['check'], ['status', '--json'], ['state'], ['next-id', 'F']]) {
    const res = spRun(dir, ...cmd);
    assert.notEqual(res.status, 3, `sp.js ${cmd.join(' ')} threw: ${res.stderr}`);
  }
});
