'use strict';
/**
 * Tier 0 — will this plugin install, and will its skills be discoverable?
 *
 * Everything below Tier 0 assumes the plugin loads. Nothing here is caught at
 * runtime: a marketplace entry with the wrong source, a skill nested one level
 * too deep, or a frontmatter key Claude Code does not read all fail by the
 * plugin simply not being there, with no error anywhere.
 *
 * The first half runs offline against the repository. The second half inspects
 * the actual installed copy under ~/.claude/plugins and skips itself until the
 * plugin has been installed, so `npm test` is meaningful either way.
 *
 * Field names and limits below come from the Agent Skills specification
 * (agentskills.io/specification) and the Claude Code skills reference
 * (code.claude.com/docs/en/skills), both checked 2026-07-26.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { REPO, PLUGIN } = require('./helpers');

const MARKETPLACE = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'marketplace.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
const SKILLS_DIR = path.join(PLUGIN, 'skills');

const skillNames = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();

// -------------------------------------------------------- marketplace & manifest

test('the marketplace manifest has everything /plugin marketplace add needs', () => {
  assert.ok(MARKETPLACE.name, 'marketplace.json needs a name');
  assert.match(MARKETPLACE.name, /^[a-z0-9-]+$/, 'marketplace name must be a slug');
  assert.ok(MARKETPLACE.owner && MARKETPLACE.owner.name, 'marketplace.json needs an owner');
  assert.ok(Array.isArray(MARKETPLACE.plugins) && MARKETPLACE.plugins.length > 0,
    'marketplace.json lists no plugins');

  for (const entry of MARKETPLACE.plugins) {
    assert.ok(entry.name, 'a marketplace entry has no name');
    assert.match(entry.name, /^[a-z0-9-]+$/, `${entry.name}: plugin name must be a slug`);
    assert.ok(entry.source, `${entry.name}: no source`);
    const src = path.join(REPO, entry.source);
    assert.ok(fs.existsSync(src), `${entry.name}: source ${entry.source} does not exist`);
    assert.ok(fs.existsSync(path.join(src, '.claude-plugin', 'plugin.json')),
      `${entry.name}: source has no .claude-plugin/plugin.json, so it is not a plugin`);
  }
});

test('the plugin manifest is well formed', () => {
  assert.equal(MANIFEST.name, 'ledgerline');
  assert.match(MANIFEST.name, /^[a-z0-9-]+$/);
  assert.match(MANIFEST.version, /^\d+\.\d+\.\d+/, 'version must be semver; /plugin update compares it');
  assert.ok(MANIFEST.description, 'no description — this is what /plugin shows in the list');
});

test('the components Claude Code auto-discovers are where it looks for them', () => {
  // Claude Code discovers these by convention from the plugin root. A directory
  // named anything else is silently ignored.
  assert.ok(fs.existsSync(SKILLS_DIR), 'no skills/ directory');
  assert.ok(fs.existsSync(path.join(PLUGIN, 'agents')), 'no agents/ directory');
  assert.ok(fs.existsSync(path.join(PLUGIN, 'hooks', 'hooks.json')), 'no hooks/hooks.json');
});

// ------------------------------------------------------------ skill discovery

test('every skill is exactly one directory deep with a SKILL.md', () => {
  assert.ok(skillNames.length > 0, 'no skills to load');
  for (const name of skillNames) {
    const file = path.join(SKILLS_DIR, name, 'SKILL.md');
    assert.ok(fs.existsSync(file), `skills/${name}/ has no SKILL.md, so it will not load`);
  }
});

test('no SKILL.md is nested where the loader will not find it', () => {
  // skills/foo/bar/SKILL.md is not discovered; it just quietly does not exist.
  const stray = [];
  (function walk(dir, depth) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name === 'SKILL.md' && depth !== 1) stray.push(path.relative(SKILLS_DIR, p));
    }
  })(SKILLS_DIR, 0);
  assert.deepEqual(stray, [], 'these SKILL.md files are at the wrong depth to be discovered');
});

test('the skills the README and router advertise all exist', () => {
  // The router table in using-ledgerline is the plugin's own index of itself.
  const contract = fs.readFileSync(path.join(SKILLS_DIR, 'using-ledgerline', 'SKILL.md'), 'utf8');
  const routed = [...contract.matchAll(/`\/ledgerline:([a-z-]+)`/g)].map((m) => m[1]);
  assert.ok(routed.length >= 8, 'the router table looks empty');
  for (const name of routed) {
    assert.ok(skillNames.includes(name), `the router offers /ledgerline:${name}, which does not exist`);
  }
  // Every skill except the contract itself should be reachable from the router.
  for (const name of skillNames) {
    if (name === 'using-ledgerline') continue;
    assert.ok(routed.includes(name), `${name} exists but the router never offers it`);
  }
});

test('only kickoff is hidden from the model', () => {
  // `disable-model-invocation: true` removes the skill's description from
  // Claude's context entirely — it becomes user-invocable only. That is correct
  // for kickoff, which runs once per project and refuses to run twice. On any
  // other skill it would silently disable automatic routing.
  const hidden = skillNames.filter((name) => {
    const text = fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
    return /^disable-model-invocation:\s*true\s*$/m.test(text.split('---')[1] || '');
  });
  assert.deepEqual(hidden, ['kickoff'],
    'a skill was hidden from the model; only kickoff should be user-invocable only');
});

test('skill bodies stay inside the progressive-disclosure budget', () => {
  // The whole body enters context on activation. The spec recommends under 500
  // lines and moving reference material into separate files.
  for (const name of skillNames) {
    const lines = fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8').split(/\r?\n/).length;
    assert.ok(lines < 500, `skills/${name}/SKILL.md is ${lines} lines; split it into reference files`);
  }
});

test('agents carry the frontmatter the loader requires', () => {
  const dir = path.join(PLUGIN, 'agents');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(text.startsWith('---'), `agents/${file}: no frontmatter`);
    const block = text.split('---')[1] || '';
    assert.match(block, /^name:\s*\S+/m, `agents/${file}: no name`);
    assert.match(block, /^description:\s*\S+/m, `agents/${file}: no description`);
  }
});

// ----------------------------------------------------------------- hook shape

test('hooks.json matches the shape Claude Code parses', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));
  assert.ok(hooks.hooks, 'hooks.json must have a top-level "hooks" key');

  const events = Object.keys(hooks.hooks);
  assert.deepEqual(events, ['SessionStart'], 'unexpected hook events declared');

  for (const [event, matchers] of Object.entries(hooks.hooks)) {
    assert.ok(Array.isArray(matchers), `${event}: value must be an array of matcher groups`);
    for (const group of matchers) {
      assert.ok(Array.isArray(group.hooks), `${event}: matcher group needs a "hooks" array`);
      for (const h of group.hooks) {
        assert.equal(h.type, 'command', `${event}: only command hooks are supported here`);
        assert.ok(h.command, `${event}: hook has no command`);
        assert.ok((h.args || []).some((a) => a.includes('${CLAUDE_PLUGIN_ROOT}')),
          `${event}: hook must locate its script through \${CLAUDE_PLUGIN_ROOT}, not a relative path`);
      }
    }
  }
});

// ------------------------------------------------- the actual installed copy

const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const INSTALLED_JSON = path.join(CLAUDE_HOME, 'plugins', 'installed_plugins.json');

function installedEntry() {
  let db;
  try { db = JSON.parse(fs.readFileSync(INSTALLED_JSON, 'utf8')); } catch { return null; }
  const key = Object.keys(db.plugins || {}).find((k) => k.split('@')[0] === MANIFEST.name);
  if (!key) return null;
  const installs = db.plugins[key];
  return { key, install: Array.isArray(installs) ? installs[0] : installs };
}

const installed = installedEntry();
const notInstalled = {
  skip: installed ? false
    : 'ledgerline is not installed yet — run /plugin marketplace add . then /plugin install ledgerline@ledgerline-marketplace',
};

test('the installed copy is the current version', notInstalled, () => {
  assert.ok(fs.existsSync(installed.install.installPath),
    `installed_plugins.json points at ${installed.install.installPath}, which does not exist`);
  assert.equal(installed.install.version, MANIFEST.version,
    'the installed version is behind the repository; run /plugin update ledgerline');
});

test('every skill in the repository made it into the installed copy', notInstalled, () => {
  const dir = path.join(installed.install.installPath, 'skills');
  assert.ok(fs.existsSync(dir), 'the installed copy has no skills/ directory');
  const got = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
    .map((e) => e.name).sort();
  assert.deepEqual(got, skillNames, 'the installed skill set differs from the repository');
});

test('the installed skill bodies match the repository byte for byte', notInstalled, () => {
  // The install is a versioned snapshot, not a link to the working tree, so
  // editing a skill here changes nothing about what a session actually loads —
  // and the version number does not move, so the check above cannot see it.
  // Without this, a Tier 3 run grades the *previous* text of a skill you just
  // edited and reports it as a pass.
  const dir = path.join(installed.install.installPath, 'skills');
  const stale = skillNames.filter((name) => {
    const mine = fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
    let theirs;
    try { theirs = fs.readFileSync(path.join(dir, name, 'SKILL.md'), 'utf8'); } catch { return true; }
    return mine !== theirs;
  });
  assert.deepEqual(stale, [],
    'the installed copy of these skills is stale; reinstall before trusting any agent-level test');
});

test('the installed hook script is present and runnable', notInstalled, () => {
  const script = path.join(installed.install.installPath, 'scripts', 'session-start.js');
  assert.ok(fs.existsSync(script), 'the SessionStart hook script did not get installed');
  assert.ok(fs.existsSync(path.join(installed.install.installPath, 'scripts', 'ledger.js')),
    'ledger.js did not get installed; every skill invokes it');
});
