'use strict';
/**
 * Tier 1 — static lint of the plugin itself.
 *
 * These tests assert that the prose and the engine agree: that every command a
 * skill tells an agent to run exists, every file it points at is on disk, and
 * every vocabulary word it teaches is one `ledger.js` actually accepts. Skills are
 * instructions to a model, so nothing here fails at runtime — it just produces
 * an agent confidently doing the wrong thing. This is the cheap net for that.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { REPO, PLUGIN, SP, sp } = require('./helpers');

const SKILLS_DIR = path.join(PLUGIN, 'skills');
const TEMPLATES_DIR = path.join(PLUGIN, 'templates');
const AGENTS_DIR = path.join(PLUGIN, 'agents');

// The SKILL.md frontmatter fields Claude Code documents. `when_to_use`,
// `argument-hint` and `disable-model-invocation` are Claude Code extensions to
// the Agent Skills standard rather than part of the portable spec — fine here,
// since this plugin only targets Claude Code, but a typo in one of them fails
// silently, which is what this allowlist is for.
const KNOWN_FRONTMATTER = new Set([
  // Agent Skills standard
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
  // Claude Code extensions
  'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation',
  'user-invocable', 'disallowed-tools', 'model', 'effort', 'context', 'agent',
  'background', 'hooks', 'paths', 'shell',
]);

// Claude Code truncates `description` + `when_to_use` at 1536 chars in the
// skill listing; the Agent Skills spec caps `description` alone at 1024.
// Anything over either limit is silently cut off, taking its triggers with it.
const DESCRIPTION_MAX = 1024;
const LISTING_MAX = 1536;

const LEDGER_FILES = [
  'PRD.md', 'ARCHITECTURE.md', 'ROADMAP.md',
  'DECISIONS.md', 'FOLLOWUPS.md', 'LESSONS.md', 'JOURNAL.md',
];

// ------------------------------------------------------------------- loading

function parseFrontmatter(text, label) {
  assert.ok(text.startsWith('---\n') || text.startsWith('---\r\n'),
    `${label}: must open with a YAML frontmatter fence`);
  const lines = text.split(/\r?\n/);
  const close = lines.indexOf('---', 1);
  assert.ok(close > 0, `${label}: frontmatter is never closed`);

  const fields = {};
  const order = [];
  for (const line of lines.slice(1, close)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    assert.ok(m, `${label}: frontmatter line is not a simple key: value pair — ${JSON.stringify(line)}`);
    fields[m[1]] = m[2].trim();
    order.push(m[1]);
  }
  return { fields, order, raw: lines.slice(0, close + 1).join('\n'), body: lines.slice(close + 1).join('\n') };
}

const skills = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => {
    const file = path.join(SKILLS_DIR, e.name, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    return { dir: e.name, file, text, ...parseFrontmatter(text, e.name) };
  });

/** Every markdown file the plugin ships that could reference the engine. */
const prose = [
  ...skills.map((s) => ({ label: `skills/${s.dir}/SKILL.md`, file: s.file, text: s.text })),
  ...fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md')).map((f) => ({
    label: `agents/${f}`, file: path.join(AGENTS_DIR, f),
    text: fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8'),
  })),
  ...fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.md')).map((f) => ({
    label: `templates/${f}`, file: path.join(TEMPLATES_DIR, f),
    text: fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8'),
  })),
];

// ------------------------------------------------------- structure & metadata

test('every skill directory holds exactly one SKILL.md', () => {
  assert.ok(skills.length > 0, 'no skills found');
  for (const s of skills) {
    assert.ok(fs.existsSync(s.file), `${s.dir}: missing SKILL.md`);
  }
});

test('skill name matches its directory and is a legal slug', () => {
  for (const s of skills) {
    assert.equal(s.fields.name, s.dir, `${s.dir}: frontmatter name disagrees with directory`);
    // Agent Skills spec: 1-64 chars, lowercase alphanumerics and single hyphens,
    // no leading or trailing hyphen.
    assert.match(s.fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/,
      `${s.dir}: name must be lowercase alphanumerics separated by single hyphens`);
    assert.ok(s.fields.name.length <= 64, `${s.dir}: name is over 64 chars`);
  }
});

test('descriptions fit in the skill listing without being truncated', () => {
  for (const s of skills) {
    const description = s.fields.description || '';
    const listing = description.length + (s.fields.when_to_use || '').length;
    assert.ok(description.length > 40, `${s.dir}: description is missing or too thin to route on`);
    assert.ok(description.length <= DESCRIPTION_MAX,
      `${s.dir}: description is ${description.length} chars, over the ${DESCRIPTION_MAX} spec cap`);
    assert.ok(listing <= LISTING_MAX,
      `${s.dir}: description + when_to_use is ${listing} chars; Claude Code truncates the listing at ${LISTING_MAX}`);
  }
});

test('no unknown frontmatter keys, and no duplicates', () => {
  for (const s of skills) {
    for (const key of s.order) {
      assert.ok(KNOWN_FRONTMATTER.has(key),
        `${s.dir}: unknown frontmatter key "${key}" — a typo here fails silently at load time`);
    }
    assert.equal(new Set(s.order).size, s.order.length, `${s.dir}: duplicate frontmatter key`);
  }
});

test('descriptions state when to use the skill, not just what it does', () => {
  // A description that only summarises the workflow gives the model a shortcut
  // it will take instead of reading the skill body.
  for (const s of skills) {
    const d = s.fields.description.toLowerCase();
    const routes = /\buse (when|the moment|whenever|at the start|before|after)\b|\btrigger\b/.test(d)
      || Boolean(s.fields.when_to_use);
    assert.ok(routes, `${s.dir}: description has no triggering condition ("Use when …") and no when_to_use`);
  }
});

// ------------------------------------------------------- references resolve

test('every ledger.js subcommand referenced in prose exists in the engine', () => {
  const source = fs.readFileSync(SP, 'utf8');
  const mainSwitch = source.slice(source.indexOf('switch (cmd) {'));
  assert.ok(mainSwitch, 'could not find the main dispatch switch in ledger.js');
  const implemented = new Set([...mainSwitch.matchAll(/case '([a-z][a-z-]+)':/g)].map((m) => m[1]));
  assert.ok(implemented.size >= 5, 'suspiciously few subcommands parsed out of ledger.js');

  const referenced = new Map();
  for (const p of prose) {
    for (const m of p.text.matchAll(/ledger\.js"?\s+([a-z][a-z-]+)/g)) {
      if (!referenced.has(m[1])) referenced.set(m[1], p.label);
    }
  }
  assert.ok(referenced.size > 0, 'no ledger.js invocations found in the skills — is the engine still wired up?');

  for (const [cmd, where] of referenced) {
    assert.ok(implemented.has(cmd),
      `${where} tells the agent to run \`ledger.js ${cmd}\`, which the engine does not implement (has: ${[...implemented].sort().join(', ')})`);
  }
});

test('every plugin file referenced through CLAUDE_PLUGIN_ROOT exists', () => {
  for (const p of prose) {
    for (const m of p.text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) {
      const rel = m[1].replace(/[.,)]+$/, '');
      assert.ok(fs.existsSync(path.join(PLUGIN, rel)),
        `${p.label} references \${CLAUDE_PLUGIN_ROOT}/${rel}, which does not exist`);
    }
  }
});

test('every /ledgerline: cross-reference resolves to a real skill', () => {
  const names = new Set(skills.map((s) => s.dir));
  for (const p of prose) {
    for (const m of p.text.matchAll(/\/ledgerline:([a-z-]+)/g)) {
      assert.ok(names.has(m[1]),
        `${p.label} points at /ledgerline:${m[1]}, which is not a skill (have: ${[...names].sort().join(', ')})`);
    }
  }
});

test('the hook manifest points at a script that exists and parses', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));
  const entries = Object.values(hooks.hooks).flat().flatMap((g) => g.hooks);
  assert.ok(entries.length > 0, 'hooks.json declares no hooks');
  for (const h of entries) {
    for (const arg of h.args || []) {
      const rel = arg.replace('${CLAUDE_PLUGIN_ROOT}/', '');
      assert.ok(fs.existsSync(path.join(PLUGIN, rel)), `hooks.json references missing ${rel}`);
    }
    assert.ok(h.timeout === undefined || h.timeout > 0, 'hook timeout must be positive');
  }
});

test('both scripts are syntactically valid', () => {
  for (const script of ['ledger.js', 'session-start.js']) {
    const res = spawnSync(process.execPath, ['--check', path.join(PLUGIN, 'scripts', script)], { encoding: 'utf8' });
    assert.equal(res.status, 0, `${script} does not parse: ${res.stderr}`);
  }
});

// ------------------------------------------------- vocabulary must not drift

/** Backticked words on the line of `text` that starts with `label`. */
function vocabularyLine(text, label) {
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(label));
  assert.ok(line, `could not find a line starting with "${label}"`);
  return [...line.matchAll(/`([a-z][a-z0-9 -]*)`/g)].map((m) => m[1]);
}

test('feature status vocabulary in the docs matches the engine constant', () => {
  const contract = skills.find((s) => s.dir === 'using-ledgerline').text;
  assert.deepEqual(vocabularyLine(contract, 'Features:'), sp.STATUSES,
    'using-ledgerline teaches a different feature vocabulary than ledger.js enforces');

  const roadmapTpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'ROADMAP.md'), 'utf8');
  assert.deepEqual(vocabularyLine(roadmapTpl, 'Status vocabulary (features):'), sp.STATUSES,
    'the ROADMAP template teaches a different feature vocabulary than ledger.js enforces');
});

test('follow-up status vocabulary matches what check() accepts', () => {
  const contract = skills.find((s) => s.dir === 'using-ledgerline').text;
  assert.deepEqual(vocabularyLine(contract, 'Follow-ups:'), ['open', 'closed', 'dropped']);
});

test('milestone vocabulary includes the words the engine keys on', () => {
  const contract = skills.find((s) => s.dir === 'using-ledgerline').text;
  const documented = vocabularyLine(contract, 'Milestones:');
  // activeMilestone() looks for status 'active' and treats 'done' as finished.
  for (const word of ['active', 'done']) {
    assert.ok(documented.includes(word),
      `milestone vocabulary omits "${word}", which ledger.js keys on`);
  }
});

// ------------------------------------------------------- templates & manifests

test('every ledger file init copies has a template', () => {
  for (const f of LEDGER_FILES) {
    assert.ok(fs.existsSync(path.join(TEMPLATES_DIR, f)), `templates/${f} is missing; init would skip it`);
  }
});

test('ledger templates only use placeholders init substitutes', () => {
  // init replaces {{PROJECT_NAME}} and {{DATE}}. Anything else leaks into a
  // real project's ledger verbatim.
  for (const f of LEDGER_FILES) {
    const text = fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8');
    for (const m of text.matchAll(/\{\{([A-Z_]+)\}\}/g)) {
      assert.ok(['PROJECT_NAME', 'DATE'].includes(m[1]),
        `templates/${f} uses {{${m[1]}}}, which init does not substitute`);
    }
  }
});

test('the FEATURE template carries the fields the engine parses out of a dossier', () => {
  const tpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'FEATURE.md'), 'utf8');
  assert.match(tpl, /\*\*Status:\*\*/, 'dossier template has no **Status:** field; check() reads it');
  assert.match(tpl, /\*\*Opened:\*\*/, 'dossier template has no **Opened:** field; STATE.md reports age from it');
  assert.match(tpl, /^\s*-\s*\[ \]/m, 'dossier template has no acceptance-criteria checkboxes');
});

test('the ROADMAP template keeps the column order the parser assumes', () => {
  const tpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'ROADMAP.md'), 'utf8');
  const header = tpl.split(/\r?\n/).find((l) => l.trim().startsWith('| ID |'));
  assert.ok(header, 'no feature table header in the ROADMAP template');
  const cols = header.split('|').map((c) => c.trim()).filter(Boolean);
  assert.deepEqual(cols, ['ID', 'Feature', 'Status', 'Deps', 'Reqs', 'Plan', 'Dossier'],
    'load() reads roadmap cells positionally; this column order is load-bearing');
});

test('plugin and marketplace manifests agree', () => {
  const marketplace = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
  const entry = marketplace.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry, `marketplace.json has no entry for "${plugin.name}"`);
  assert.equal(entry.version, plugin.version, 'marketplace and plugin manifest versions disagree');
  assert.ok(fs.existsSync(path.join(REPO, entry.source)), `marketplace source ${entry.source} does not exist`);
});
