'use strict';
/**
 * Shared test harness for the Ledgerline plugin.
 *
 * Dependency-free, like the thing it tests. Provides throwaway repositories,
 * a CLI runner for ledger.js and the SessionStart hook, and builders for a ledger
 * that is valid by construction — negative fixtures are made by mutating it,
 * so each failing test differs from a passing one in exactly one way.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const PLUGIN = path.join(REPO, 'plugins', 'ledgerline');
const SP = path.join(PLUGIN, 'scripts', 'ledger.js');
const HOOK = path.join(PLUGIN, 'scripts', 'session-start.js');

// The engine is required directly for its constants and date helpers, so the
// tests cannot drift from the vocabulary the code actually enforces.
const sp = require(SP);

const TEMP_DIRS = [];

process.on('exit', () => {
  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

// ------------------------------------------------------------------ fixtures

/**
 * A throwaway directory that looks like a git repo to ledger.js's `locate()`.
 * realpath matters on macOS, where the tmpdir is a symlink and paths compared
 * against process.cwd() would otherwise disagree.
 */
function makeRepo(files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ledgerline-test-')));
  TEMP_DIRS.push(dir);
  fs.mkdirSync(path.join(dir, '.git'));
  if (files) writeFiles(dir, files);
  return dir;
}

function writeFiles(dir, files) {
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
}

function readFile(dir, rel) {
  try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { return null; }
}

/** Read → transform → write, for building a negative fixture from a valid one. */
function mutate(dir, rel, fn) {
  const target = path.join(dir, rel);
  fs.writeFileSync(target, fn(fs.readFileSync(target, 'utf8')));
}

// ------------------------------------------------------------------- running

function run(script, args, opts) {
  const o = opts || {};
  const res = spawnSync(process.execPath, [script, ...args], {
    cwd: o.cwd || REPO,
    encoding: 'utf8',
    input: o.input === undefined ? '' : o.input,
    env: { ...process.env, ...(o.env || {}) },
    timeout: o.timeout || 30000,
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    out: (res.stdout || '') + (res.stderr || ''),
  };
}

/** Run ledger.js against `dir`. Uses --cwd rather than spawning inside the repo,
 *  which also keeps the flag-placement contract under test. */
function spRun(dir, ...args) {
  return run(SP, [...args, '--cwd', dir]);
}

function hookRun(opts) {
  return run(HOOK, [], opts);
}

// ------------------------------------------------------------- ledger builder

const TODAY = sp.isoDate();

function dossier(o) {
  const boxes = (o.criteria || []).map((c) => `- [${c[0] ? 'x' : ' '}] ${c[1]}`).join('\n');
  return `# ${o.id} — ${o.title}

- **Status:** ${o.status}
- **Milestone:** ${o.milestone || 'M1'}
- **Requirements:** ${o.reqs || 'R-001'}
- **Depends on:** ${o.deps || '—'}
- **Plan:** —
- **Opened:** ${o.opened || TODAY}
- **Closed:** —

## Goal

A user can do the thing they could not do before.

## Acceptance criteria

${boxes}

## Status log

- ${o.opened || TODAY} — created, ${o.status}.

## Verification

Ran \`npm test\`; output was green.
`;
}

/**
 * A ledger that `ledger.js check` reports as completely clean. Every negative
 * fixture in the engine tests is this, minus one thing.
 */
function validLedger() {
  return {
    'docs/project/PRD.md': `# Demo — PRD

## Requirements

| ID | Requirement | Priority |
|---|---|---|
| R-001 | The skeleton runs end to end | must |
| R-002 | A user can sign in | must |
`,

    'docs/project/ARCHITECTURE.md': `# Demo — Architecture

## Stack

Node, no framework.

## Undecided

| Question | Why not yet | Decide by |
|---|---|---|
`,

    'docs/project/ROADMAP.md': `# Demo — Roadmap

Status vocabulary (features): \`planned\` · \`in-progress\` · \`blocked\` · \`in-review\` · \`done\` · \`dropped\`

## M1 — Walking skeleton

- **Status:** active
- **Goal:** the thinnest end-to-end slice that runs.
- **Exit criteria:** one command runs it locally.

| ID | Feature | Status | Deps | Reqs | Plan | Dossier |
|---|---|---|---|---|---|---|
| F-001 | Skeleton | done | — | R-001 | — | docs/project/features/F-001-skeleton.md |
| F-002 | Sign in | in-progress | F-001 | R-002 | — | docs/project/features/F-002-sign-in.md |
| F-003 | Profile page | planned | F-002 | R-002 | — | — |
`,

    'docs/project/DECISIONS.md': `# Demo — Decisions

### D-001 — Use Node with no dependencies

**Context:** the plugin must run anywhere Claude Code runs.
**Decision:** standard library only.
**Consequences:** more code, no supply chain.
`,

    'docs/project/FOLLOWUPS.md': `# Demo — Follow-ups

| ID | Follow-up | Status | Trigger | Size | Origin |
|---|---|---|---|---|---|
| U-001 | Add integration tests | open | before the first release | S | F-001 |
`,

    'docs/project/LESSONS.md': `# Demo — Lessons

### L-001 — Parsers drift from prose

**What happened:** the vocabulary in the docs outgrew the regex.
**Rule:** assert the documented vocabulary against the code's constant.
`,

    'docs/project/JOURNAL.md': `# Demo — Journal

## ${TODAY} — set up the skeleton

Built F-001, started F-002.
`,

    'docs/project/features/F-001-skeleton.md': dossier({
      id: 'F-001', title: 'Skeleton', status: 'done',
      criteria: [[true, 'One command starts it'], [true, 'CI is green']],
    }),

    'docs/project/features/F-002-sign-in.md': dossier({
      id: 'F-002', title: 'Sign in', status: 'in-progress', reqs: 'R-002', deps: 'F-001',
      criteria: [[true, 'A user can submit credentials'], [false, 'A bad password is rejected']],
    }),
  };
}

/** A repo with a clean ledger and a freshly generated STATE.md. */
function makeLedgerRepo(overrides) {
  const dir = makeRepo({ ...validLedger(), ...(overrides || {}) });
  fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
  const gen = spRun(dir, 'state');
  if (gen.status !== 0) throw new Error('fixture failed to generate STATE.md: ' + gen.out);
  return dir;
}

// ------------------------------------------------------------------ assertions

/** Findings from `ledger.js check`, split by level, parsed from its output. */
function findings(dir) {
  const res = spRun(dir, 'check');
  const errors = [];
  const warnings = [];
  for (const line of res.stdout.split(/\r?\n/)) {
    const m = line.match(/^\[(error|warn)\]\s+(.*)$/);
    if (!m) continue;
    (m[1] === 'error' ? errors : warnings).push(m[2]);
  }
  return { status: res.status, errors, warnings, stdout: res.stdout };
}

module.exports = {
  REPO, PLUGIN, SP, HOOK, TODAY, sp,
  makeRepo, makeLedgerRepo, validLedger, dossier,
  writeFiles, readFile, mutate,
  run, spRun, hookRun, findings,
};
