#!/usr/bin/env node
'use strict';
/**
 * Tier 3 driver.
 *
 *   node tests/tier3/run.js prepare [--only a1,b4] [--dir <path>]
 *   node tests/tier3/run.js grade   [--only a1,b4] [--dir <path>] [--verbose]
 *   node tests/tier3/run.js clean   [--dir <path>]
 *
 * `prepare` builds a fixture copy per scenario and prints the prompt to
 * dispatch. Dispatching is not automated on purpose: the whole point is a fresh
 * agent with a real skill listing, which a plain Node process cannot produce.
 * Run each printed prompt as a subagent, then `grade`.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const { build } = require('./build-fixture');
const { SCENARIOS, TEMPLATE, CANARY } = require('./scenarios');
const { inspect, evaluate, architectureDefectCorrected } = require('./oracles');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SP = path.join(REPO_ROOT, 'plugins', 'superproj', 'scripts', 'sp.js');

const argv = process.argv.slice(2);
const cmd = argv[0] || 'help';
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const has = (name) => argv.includes(name);

const RUN_DIR = flag('--dir') || path.join(os.tmpdir(), 'superproj-tier3');
const MANIFEST = path.join(RUN_DIR, 'manifest.json');
const only = (flag('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const selected = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
}

/**
 * The fixture's last commit. Agents may commit on top, so the baseline cannot
 * be HEAD; it is recorded at prepare time and re-derivable from the message.
 */
function resolveBaseline(dir) {
  try {
    const sha = execSync('git log --format=%H -1 --grep="docs: generate STATE.md"',
      { cwd: dir, encoding: 'utf8' }).trim();
    if (sha) return sha;
  } catch { /* fall through */ }
  return 'HEAD';
}

// ------------------------------------------------------------------- canary

if (cmd === 'canary') {
  const src = path.join(REPO_ROOT, 'plugins', 'superproj', 'skills', CANARY.file);
  const present = fs.readFileSync(src, 'utf8').includes(CANARY.phrase);
  if (!present) {
    console.log(red(`the canary phrase is not in ${CANARY.file} — update CANARY in scenarios.js first`));
    process.exit(2);
  }
  console.log(bold('Staleness canary — run this BEFORE trusting any prepare/grade cycle.\n'));
  console.log(dim('Skill bodies reach subagents from a registry loaded when the plugin loaded.'));
  console.log(dim('Editing SKILL.md on disk does not refresh it, and no file comparison can tell.\n'));
  console.log('─'.repeat(76));
  console.log(`Invoke the skill \`superproj:${CANARY.skill}\`. Answer one question using ONLY the skill text that the Skill tool loaded into your context: does a sentence containing the words "${CANARY.phrase}" appear in it?

Do not open, read, search or inspect any file on disk, and do not look for the skill's source — reading the file defeats the entire purpose of this question, because the file and the loaded text are exactly what is being compared. Answer YES plus that full sentence quoted from the loaded text, or NO.`);
  console.log('─'.repeat(76));
  console.log(`\n${bold('YES')} + the sentence → the registry is current; results are trustworthy.`);
  console.log(`${bold('NO')} → the agent is reading pre-edit text. Run ${bold('/reload-plugins')} (or restart the`);
  console.log('     session) and re-run this canary. Any result gathered before that is void.');
  process.exit(0);
}

// ------------------------------------------------------------------ prepare

if (cmd === 'prepare') {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const baseDir = path.join(RUN_DIR, '_base');
  process.stdout.write('building fixture… ');
  build(baseDir, SP);
  console.log('clean.\n');

  const manifest = readManifest();
  for (const s of selected) {
    const dir = path.join(RUN_DIR, s.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync(baseDir, dir, { recursive: true });
    manifest[s.id] = { dir, baseline: resolveBaseline(dir), preparedAt: new Date().toISOString() };
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  console.log(bold(`${selected.length} scenario(s) prepared under ${RUN_DIR}`));
  console.log(dim('Dispatch each prompt below as its own subagent, then run: node tests/tier3/run.js grade\n'));
  for (const s of selected) {
    console.log('─'.repeat(76));
    console.log(bold(`${s.id.toUpperCase()}  [${s.kind}]  ${s.invariant}`));
    if (s.pressures) console.log(dim(`pressures: ${s.pressures}`));
    if (s.routesTo) console.log(dim(`expected route: ${s.routesTo}`));
    console.log('─'.repeat(76));
    console.log(TEMPLATE.replace('{{REPO}}', manifest[s.id].dir).replace('{{TASK}}', s.task));
    console.log();
  }
  process.exit(0);
}

// -------------------------------------------------------------------- grade

if (cmd === 'grade') {
  const manifest = readManifest();
  let failed = 0, graded = 0;

  for (const s of selected) {
    const entry = manifest[s.id];
    if (!entry || !fs.existsSync(entry.dir)) {
      console.log(`${bold(s.id.toUpperCase())}  ${dim('not prepared — skipping')}`);
      continue;
    }
    graded++;
    const state = inspect(entry.dir, SP, entry.baseline);
    const results = evaluate(state, s.expect);
    const bad = results.filter((r) => !r.ok);
    if (bad.length) failed++;

    console.log('\n' + '═'.repeat(76));
    console.log(`${bold(s.id.toUpperCase())}  ${bad.length ? red('FAIL') : green('PASS')}   ${s.invariant}`);
    console.log('═'.repeat(76));
    for (const r of results) {
      if (r.ok && !has('--verbose')) continue;
      console.log(`  ${r.ok ? green('✓') : red('✗')} ${r.name}: ${r.detail}`);
    }
    if (!bad.length && !has('--verbose')) console.log(dim(`  all ${results.length} checks passed`));

    if (state.warnings.length) console.log(dim(`  warnings: ${state.warnings.length}`));
    if (state.extraWorktrees > 0) {
      console.log(dim(`  ${state.extraWorktrees} extra worktree(s): work may live on a branch these predicates cannot see — verdict is about this tree only`));
    }
    console.log(dim(`  planted ARCHITECTURE defect: ${architectureDefectCorrected(state) ? 'corrected in ledger' : 'not corrected (may still have been reported — check transcript)'}`));
    console.log(dim(`  read the transcript for: ${s.manual}`));
  }

  console.log('\n' + '═'.repeat(76));
  console.log(bold(`${graded - failed}/${graded} scenarios passed`));
  if (failed) console.log(dim('A failure is a skill defect to fix, then re-run. See tests/tier3/README.md.'));
  process.exit(failed ? 1 : 0);
}

// -------------------------------------------------------------------- clean

if (cmd === 'clean') {
  fs.rmSync(RUN_DIR, { recursive: true, force: true });
  console.log(`removed ${RUN_DIR}`);
  process.exit(0);
}

console.log(`Tier 3 — agent-level behavioural tests for the SuperProj skills.

  node tests/tier3/run.js canary                   check the skills are actually live
  node tests/tier3/run.js prepare [--only a1,b4] [--dir <path>]
  node tests/tier3/run.js grade   [--only a1,b4] [--dir <path>] [--verbose]
  node tests/tier3/run.js clean   [--dir <path>]

Scenarios: ${SCENARIOS.map((s) => s.id).join(', ')}

After editing any skill, run canary first. Skill edits do not reach subagents
until /reload-plugins; without that check a re-run grades the old text as a pass.`);
process.exit(cmd === 'help' ? 0 : 2);
