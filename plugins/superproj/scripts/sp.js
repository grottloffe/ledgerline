#!/usr/bin/env node
/**
 * sp.js — the SuperProj ledger engine.
 *
 * Dependency-free, cross-platform (Windows/macOS/Linux) CLI used by SuperProj
 * skills and the SessionStart hook. Never interactive, never networked.
 *
 * Subcommands:
 *   init   [--name "X"] [--force]      scaffold the ledger
 *   status [--brief | --json]          roll up current state
 *   check                              validate the ledger (exit 1 on errors)
 *   next-id <F|D|U|L|R|M>              allocate the next free ID
 *   today                              current date/time, for ledger stamps
 *   paths                              resolved ledger paths
 *
 * Global: --cwd <dir> to start the ledger search somewhere other than the
 * working directory. Flags may appear before or after the subcommand.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const STATUSES = ['planned', 'in-progress', 'blocked', 'in-review', 'done', 'dropped'];
const OPEN_STATUSES = ['planned', 'in-progress', 'blocked', 'in-review'];
const LEDGER_FILES = [
  'PRD.md', 'ARCHITECTURE.md', 'ROADMAP.md',
  'DECISIONS.md', 'FOLLOWUPS.md', 'LESSONS.md', 'JOURNAL.md',
];

// ---------------------------------------------------------------- utilities

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function isoDate(d) {
  const x = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

function isoMinutes(d) {
  const x = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${isoDate(x)} ${p(x.getHours())}:${p(x.getMinutes())}`;
}

function daysBetween(aStr, b) {
  const a = new Date(aStr + 'T00:00:00');
  if (isNaN(a)) return null;
  return Math.floor((b - a) / 86400000);
}

/**
 * Parse markdown table rows whose first cell is an ID like `F-012`.
 * Tolerates missing trailing pipes and ragged column counts.
 */
function idRows(text, prefix) {
  if (!text) return [];
  const re = new RegExp('^' + prefix + '-\\d+$');
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    let cells = line.split('|');
    cells.shift();                                  // drop before leading pipe
    if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
    cells = cells.map((s) => s.trim());
    if (cells.length && re.test(cells[0])) out.push(cells);
  }
  return out;
}

/**
 * Parse `### D-001 — Title` style entry headings.
 * The negative lookahead stops template placeholders such as `### L-0NN — …`
 * from being counted as a real entry `L-0`.
 */
function idHeadings(text, prefix) {
  if (!text) return [];
  const re = new RegExp('^#{2,4}\\s+(' + prefix + '-\\d+)(?![\\dA-Za-z])\\s*[—:-]?\\s*(.*)$');
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(re);
    if (m) out.push({ id: m[1], title: (m[2] || '').trim() });
  }
  return out;
}

function idNum(id) {
  const m = String(id).match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function field(text, label) {
  if (!text) return null;
  const re = new RegExp('^\\s*[-*]?\\s*\\*\\*' + label + ':?\\*\\*\\s*(.*)$', 'im');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------- discovery

function locate(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  let repoRoot = null;
  for (;;) {
    if (exists(path.join(dir, 'docs', 'project', 'ROADMAP.md'))) {
      return { root: dir, ledger: path.join(dir, 'docs', 'project'), hasLedger: true };
    }
    if (!repoRoot && exists(path.join(dir, '.git'))) repoRoot = dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const root = repoRoot || path.resolve(startDir || process.cwd());
  return { root, ledger: path.join(root, 'docs', 'project'), hasLedger: false };
}

// ---------------------------------------------------------------- ledger model

function load(loc) {
  const L = loc.ledger;
  const files = {};
  for (const f of LEDGER_FILES) files[f] = read(path.join(L, f));

  const model = {
    root: loc.root,
    ledger: L,
    hasLedger: loc.hasLedger,
    name: null,
    milestones: [],
    features: [],
    followups: [],
    decisions: [],
    lessons: [],
    requirements: [],
    journal: [],
    files,
  };

  // Project name: first H1 of PRD, else ROADMAP, else directory name.
  for (const key of ['PRD.md', 'ROADMAP.md']) {
    const t = files[key];
    if (!t) continue;
    const m = t.match(/^#\s+(.+)$/m);
    if (m) { model.name = m[1].replace(/\s*[—-]\s*(PRD|Product Requirements|Roadmap).*$/i, '').trim(); break; }
  }
  if (!model.name) model.name = path.basename(loc.root);

  // Roadmap: milestones + feature rows.
  const roadmap = files['ROADMAP.md'] || '';
  let current = null;
  for (const raw of roadmap.split(/\r?\n/)) {
    const line = raw.trim();
    const mh = line.match(/^##\s+(M\d+)\s*[—:-]?\s*(.*)$/);
    if (mh) {
      current = { id: mh[1], title: (mh[2] || '').trim(), status: null, features: [] };
      model.milestones.push(current);
      continue;
    }
    if (current) {
      const st = line.match(/^[-*]?\s*\*\*Status:?\*\*\s*(.*)$/i);
      if (st && !current.status) current.status = st[1].trim().toLowerCase();
    }
  }
  for (const cells of idRows(roadmap, 'F')) {
    // | ID | Feature | Status | Deps | Reqs | Plan | Dossier |
    const f = {
      id: cells[0],
      title: cells[1] || '',
      status: (cells[2] || '').toLowerCase(),
      deps: (cells[3] || '').split(/[,\s]+/).filter((s) => /^F-\d+$/.test(s)),
      reqs: (cells[4] || '').split(/[,\s]+/).filter((s) => /^R-\d+$/.test(s)),
      plan: stripLink(cells[5] || ''),
      dossier: stripLink(cells[6] || ''),
      milestone: null,
    };
    model.features.push(f);
  }
  // Attach features to milestones by scanning the roadmap in order.
  {
    let ms = null;
    const byId = new Map(model.features.map((f) => [f.id, f]));
    for (const raw of roadmap.split(/\r?\n/)) {
      const line = raw.trim();
      const mh = line.match(/^##\s+(M\d+)\b/);
      if (mh) { ms = model.milestones.find((m) => m.id === mh[1]) || null; continue; }
      const fm = line.match(/^\|\s*(F-\d+)\s*\|/);
      if (fm && ms) {
        const f = byId.get(fm[1]);
        if (f && !f.milestone) { f.milestone = ms.id; ms.features.push(f); }
      }
    }
  }

  for (const cells of idRows(files['FOLLOWUPS.md'], 'U')) {
    model.followups.push({
      id: cells[0], title: cells[1] || '', status: (cells[2] || '').toLowerCase(),
      trigger: cells[3] || '', size: cells[4] || '', origin: cells[5] || '',
    });
  }
  for (const cells of idRows(files['PRD.md'], 'R')) {
    model.requirements.push({ id: cells[0], title: cells[1] || '', priority: cells[2] || '' });
  }
  model.decisions = idHeadings(files['DECISIONS.md'], 'D');
  model.lessons = idHeadings(files['LESSONS.md'], 'L');

  const journal = files['JOURNAL.md'] || '';
  for (const raw of journal.split(/\r?\n/)) {
    const m = raw.trim().match(/^##\s+(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?\s*[—:-]?\s*(.*)$/);
    if (m) model.journal.push({ date: m[1], title: (m[2] || '').trim() });
  }
  model.journal.sort((a, b) => (a.date < b.date ? -1 : 1));

  return model;
}

function stripLink(cell) {
  if (!cell || cell === '—' || cell === '-') return '';
  const m = cell.match(/\]\(([^)]+)\)/);
  return (m ? m[1] : cell).replace(/^`|`$/g, '').trim();
}

function activeMilestone(m) {
  return m.milestones.find((x) => x.status === 'active')
    || m.milestones.find((x) => x.features.some((f) => OPEN_STATUSES.includes(f.status)))
    || m.milestones.find((x) => x.status !== 'done')
    || null;
}

function readyFeatures(m) {
  const done = new Set(m.features.filter((f) => f.status === 'done').map((f) => f.id));
  return m.features.filter((f) => f.status === 'planned' && f.deps.every((d) => done.has(d)));
}

// ---------------------------------------------------------------- check

function check(m) {
  const findings = [];
  const E = (msg, fix) => findings.push({ level: 'error', msg, fix });
  const W = (msg, fix) => findings.push({ level: 'warn', msg, fix });

  if (!m.hasLedger) {
    return [{ level: 'error', msg: 'No ledger found (docs/project/ROADMAP.md missing).', fix: 'Run /superproj:kickoff to create one.' }];
  }

  for (const f of LEDGER_FILES) {
    if (m.files[f] === null) W(`Ledger file ${f} is missing.`, 'Re-run `sp.js init` to restore it from template.');
  }

  const seen = new Map();
  for (const list of [m.features, m.followups, m.decisions, m.lessons, m.requirements]) {
    for (const it of list) {
      if (seen.has(it.id)) E(`Duplicate ID ${it.id} ("${it.title}" vs "${seen.get(it.id)}").`, 'Renumber the newer entry; IDs are permanent.');
      else seen.set(it.id, it.title);
    }
  }

  const ids = new Set(m.features.map((f) => f.id));
  const inProgress = m.features.filter((f) => f.status === 'in-progress');
  if (inProgress.length > 1) {
    E(`${inProgress.length} features are in-progress (${inProgress.map((f) => f.id).join(', ')}); the limit is 1 per worktree.`,
      'Move all but one back to planned or blocked, or confirm each lives in its own worktree.');
  }

  for (const f of m.features) {
    if (!STATUSES.includes(f.status)) {
      E(`${f.id} has status "${f.status || '(empty)'}", which is not in the vocabulary.`, `Use one of: ${STATUSES.join(', ')}.`);
    }
    for (const d of f.deps) if (!ids.has(d)) E(`${f.id} depends on ${d}, which is not on the roadmap.`, 'Fix the dependency or add the missing feature.');
    if (f.status === 'done') {
      for (const d of f.deps) {
        const dep = m.features.find((x) => x.id === d);
        if (dep && dep.status !== 'done' && dep.status !== 'dropped') W(`${f.id} is done but its dependency ${d} is ${dep.status}.`, 'Check whether the dependency was actually needed.');
      }
    }
    if (f.plan && !exists(path.join(m.root, f.plan))) W(`${f.id} references plan ${f.plan}, which does not exist.`, 'Fix the path or clear the cell.');

    const needsDossier = f.status !== 'planned' && f.status !== 'dropped';
    const dossierPath = f.dossier ? path.join(m.root, f.dossier) : null;
    if (needsDossier && (!dossierPath || !exists(dossierPath))) {
      E(`${f.id} is ${f.status} but has no dossier file.`, 'Run /superproj:start-feature, or create the dossier from templates/FEATURE.md.');
    }
    if (dossierPath && exists(dossierPath)) {
      const doc = read(dossierPath) || '';
      const dStatus = (field(doc, 'Status') || '').toLowerCase();
      if (dStatus && dStatus !== f.status) {
        E(`${f.id}: roadmap says "${f.status}", dossier says "${dStatus}".`, 'Reconcile with /superproj:resume; the roadmap wins unless git says otherwise.');
      }
      const criteria = doc.match(/^\s*[-*]\s*\[( |x|X)\]/gm) || [];
      if (!criteria.length && f.status !== 'planned') {
        W(`${f.id} has no acceptance-criteria checkboxes in its dossier.`, 'Add criteria before planning; unverifiable features cannot be closed.');
      }
      if (f.status === 'done' && criteria.some((c) => /\[ \]/.test(c))) {
        E(`${f.id} is marked done but has unchecked acceptance criteria.`, 'Verify and tick them, or reopen the feature.');
      }
    }
  }

  // Plans on disk that nothing points at.
  const plansDir = path.join(m.root, 'docs', 'plans');
  if (exists(plansDir)) {
    const linked = new Set();
    for (const f of m.features) if (f.plan) linked.add(path.basename(f.plan));
    let planFiles = [];
    try { planFiles = fs.readdirSync(plansDir).filter((x) => x.endsWith('.md')); } catch { /* ignore */ }
    for (const p of planFiles) {
      if (!linked.has(p)) W(`Plan docs/plans/${p} is not linked from any roadmap row.`, 'Link it to its feature, or note in the journal why it was abandoned.');
    }
  }

  for (const u of m.followups) {
    if (!['open', 'closed', 'dropped'].includes(u.status)) W(`${u.id} has status "${u.status || '(empty)'}".`, 'Use open, closed or dropped.');
    if (u.status === 'open' && (!u.trigger || u.trigger === '—' || /^tbd$/i.test(u.trigger))) {
      W(`${u.id} is open with no trigger.`, 'State the condition that makes this urgent, or drop it.');
    }
  }

  // `(?![\dA-Za-z])` keeps template placeholders like "D-0NN" from being read as real references.
  const superseded = (m.files['DECISIONS.md'] || '').match(/superseded by (D-\d+)(?![\dA-Za-z])/gi) || [];
  const dIds = new Set(m.decisions.map((d) => d.id));
  for (const s of superseded) {
    const id = s.match(/(D-\d+)/)[1];
    if (!dIds.has(id)) E(`A decision claims it is superseded by ${id}, which does not exist.`, 'Add the replacement decision or fix the reference.');
  }

  const last = m.journal[m.journal.length - 1];
  if (inProgress.length && last) {
    const age = daysBetween(last.date, new Date());
    if (age !== null && age > 14) W(`Work is in flight but the journal has not been touched in ${age} days.`, 'Add a journal entry so the next session can pick up.');
  }
  if (!m.journal.length) W('JOURNAL.md has no entries.', 'Log a line per work session; it is what makes resuming cheap.');

  if (!m.features.length) W('The roadmap has no features.', 'Run /superproj:kickoff or /superproj:roadmap to populate it.');

  return findings;
}

// ---------------------------------------------------------------- reporting

function brief(m) {
  if (!m.hasLedger) return null;
  const out = [];
  const ms = activeMilestone(m);
  const done = m.features.filter((f) => f.status === 'done').length;
  const total = m.features.filter((f) => f.status !== 'dropped').length;

  out.push(`SuperProj ledger at docs/project/ — project "${m.name}" (${done}/${total} features done).`);
  if (ms) {
    const md = ms.features.filter((f) => f.status === 'done').length;
    out.push(`Current milestone: ${ms.id} ${ms.title} (${md}/${ms.features.length} done).`);
  }

  const flight = m.features.filter((f) => f.status === 'in-progress' || f.status === 'in-review');
  if (flight.length) {
    out.push('In flight: ' + flight.map((f) => `${f.id} ${f.title} [${f.status}]${f.plan ? ' plan: ' + f.plan : ''}`).join('; ') + '.');
  } else {
    out.push('In flight: nothing.');
  }

  const blocked = m.features.filter((f) => f.status === 'blocked');
  if (blocked.length) out.push('Blocked: ' + blocked.map((f) => `${f.id} ${f.title}`).join('; ') + '.');

  const ready = readyFeatures(m).slice(0, 3);
  if (ready.length) out.push('Ready to start: ' + ready.map((f) => `${f.id} ${f.title}`).join('; ') + '.');

  const openU = m.followups.filter((u) => u.status === 'open').length;
  out.push(`Ledger: ${m.decisions.length} decisions, ${openU} open follow-ups, ${m.lessons.length} lessons.`);

  const last = m.journal[m.journal.length - 1];
  if (last) out.push(`Last journal entry: ${last.date} — ${last.title}.`);

  const findings = check(m);
  const errs = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');
  if (errs.length) out.push(`Ledger check: ${errs.length} error(s), first: ${errs[0].msg}`);
  else if (warns.length) out.push(`Ledger check: clean, ${warns.length} warning(s).`);
  else out.push('Ledger check: clean.');

  out.push('Read the skill superproj:using-superproj before editing any ledger file. Run /superproj:resume before starting new work in a fresh session.');
  return out.join('\n');
}

function statusMd(m) {
  if (!m.hasLedger) {
    return `No SuperProj ledger found under ${m.root}.\nRun /superproj:kickoff to create one from a PRD or an idea.`;
  }
  const out = [`# Project status — ${m.name}`, '', `_Generated ${isoMinutes()}_`, ''];
  const ms = activeMilestone(m);
  out.push('## Where we are', '');
  out.push(ms ? `Current milestone: **${ms.id} ${ms.title}**` : 'No active milestone.');
  out.push('');
  out.push('| Milestone | Status | Done | Total |', '|---|---|---|---|');
  for (const x of m.milestones) {
    out.push(`| ${x.id} ${x.title} | ${x.status || '—'} | ${x.features.filter((f) => f.status === 'done').length} | ${x.features.length} |`);
  }
  out.push('', '## Features', '', '| ID | Feature | Status | Milestone | Deps | Plan |', '|---|---|---|---|---|---|');
  for (const f of m.features) {
    out.push(`| ${f.id} | ${f.title} | ${f.status} | ${f.milestone || '—'} | ${f.deps.join(' ') || '—'} | ${f.plan || '—'} |`);
  }
  const ready = readyFeatures(m);
  out.push('', '## Ready to start', '');
  out.push(ready.length ? ready.map((f) => `- ${f.id} ${f.title}`).join('\n') : '- (nothing unblocked)');
  const openU = m.followups.filter((u) => u.status === 'open');
  out.push('', `## Open follow-ups (${openU.length})`, '');
  out.push(openU.length ? openU.map((u) => `- ${u.id} ${u.title} — trigger: ${u.trigger || '—'}`).join('\n') : '- (none)');
  out.push('', '## Recent journal', '');
  const recent = m.journal.slice(-5).reverse();
  out.push(recent.length ? recent.map((j) => `- ${j.date} — ${j.title}`).join('\n') : '- (none)');

  const findings = check(m);
  out.push('', `## Ledger check (${findings.filter((f) => f.level === 'error').length} errors, ${findings.filter((f) => f.level === 'warn').length} warnings)`, '');
  out.push(findings.length ? findings.map((f) => `- **${f.level}**: ${f.msg}${f.fix ? ` _(${f.fix})_` : ''}`).join('\n') : '- clean');
  return out.join('\n');
}

function toJson(m) {
  const findings = check(m);
  return JSON.stringify({
    hasLedger: m.hasLedger,
    root: m.root,
    ledger: m.ledger,
    name: m.name,
    today: isoDate(),
    now: isoMinutes(),
    activeMilestone: activeMilestone(m),
    milestones: m.milestones.map((x) => ({ id: x.id, title: x.title, status: x.status, features: x.features.map((f) => f.id) })),
    features: m.features,
    ready: readyFeatures(m).map((f) => f.id),
    followupsOpen: m.followups.filter((u) => u.status === 'open'),
    counts: {
      features: m.features.length,
      done: m.features.filter((f) => f.status === 'done').length,
      decisions: m.decisions.length,
      lessons: m.lessons.length,
      followupsOpen: m.followups.filter((u) => u.status === 'open').length,
      requirements: m.requirements.length,
    },
    lastJournal: m.journal[m.journal.length - 1] || null,
    findings,
    nextIds: {
      F: nextId(m, 'F'), D: nextId(m, 'D'), U: nextId(m, 'U'),
      L: nextId(m, 'L'), R: nextId(m, 'R'), M: nextMilestone(m),
    },
  }, null, 2);
}

// ---------------------------------------------------------------- ids

function nextId(m, prefix) {
  let max = 0;
  const bump = (id) => { max = Math.max(max, idNum(id)); };
  switch (prefix) {
    case 'F':
      m.features.forEach((f) => bump(f.id));
      try {
        for (const f of fs.readdirSync(path.join(m.ledger, 'features'))) {
          const mm = f.match(/^F-(\d+)/); if (mm) max = Math.max(max, parseInt(mm[1], 10));
        }
      } catch { /* no features dir */ }
      break;
    case 'D': m.decisions.forEach((d) => bump(d.id)); break;
    case 'L': m.lessons.forEach((l) => bump(l.id)); break;
    case 'U': m.followups.forEach((u) => bump(u.id)); break;
    case 'R': m.requirements.forEach((r) => bump(r.id)); break;
    default: return null;
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function nextMilestone(m) {
  let max = 0;
  m.milestones.forEach((x) => { max = Math.max(max, parseInt(x.id.slice(1), 10) || 0); });
  return `M${max + 1}`;
}

// ---------------------------------------------------------------- init

function init(loc, opts) {
  const tplDir = path.join(__dirname, '..', 'templates');
  const L = loc.ledger;
  fs.mkdirSync(path.join(L, 'features'), { recursive: true });
  fs.mkdirSync(path.join(L, 'reviews'), { recursive: true });
  fs.mkdirSync(path.join(loc.root, 'docs', 'plans'), { recursive: true });
  const written = [];
  const skipped = [];
  const name = opts.name || path.basename(loc.root);
  const today = isoDate();

  const toCopy = LEDGER_FILES.slice();
  for (const f of toCopy) {
    const dest = path.join(L, f);
    if (exists(dest) && !opts.force) { skipped.push(f); continue; }
    let body = read(path.join(tplDir, f));
    if (body === null) { skipped.push(f + ' (template missing)'); continue; }
    body = body.replace(/\{\{PROJECT_NAME\}\}/g, name).replace(/\{\{DATE\}\}/g, today);
    fs.writeFileSync(dest, body);
    written.push(f);
  }
  for (const d of ['features', 'reviews']) {
    const keep = path.join(L, d, '.gitkeep');
    if (!exists(keep)) fs.writeFileSync(keep, '');
  }

  // Append-only ledger files use union merge so parallel worktrees don't
  // conflict on every added entry. Duplicate IDs that union merge can produce
  // are caught by `sp.js check`.
  const gaPath = path.join(loc.root, '.gitattributes');
  const gaLines = [
    'docs/project/DECISIONS.md merge=union',
    'docs/project/LESSONS.md merge=union',
    'docs/project/JOURNAL.md merge=union',
    'docs/project/FOLLOWUPS.md merge=union',
  ];
  const existing = read(gaPath) || '';
  const missing = gaLines.filter((l) => !existing.includes(l.split(' ')[0]));
  let gitattributes = 'already configured';
  if (missing.length) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(gaPath, existing + prefix +
      (existing ? '\n' : '') + '# SuperProj: append-only ledger files\n' + missing.join('\n') + '\n');
    gitattributes = `${missing.length} line(s) added`;
  }

  return { written, skipped, ledger: L, name, gitattributes };
}

// ---------------------------------------------------------------- main

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };

  // Positional args are everything that is neither a flag nor a flag's value,
  // so `sp.js --cwd /x status` and `sp.js status --cwd /x` behave the same.
  const flagValues = new Set(['--cwd', '--name', '--dir'].map(valueOf).filter(Boolean));
  const positional = argv.filter((a) => !a.startsWith('--') && !flagValues.has(a));

  const cmd = positional[0] || 'status';
  const loc = locate(valueOf('--cwd') || process.cwd());

  switch (cmd) {
    case 'today':
      process.stdout.write(`date: ${isoDate()}\ndatetime: ${isoMinutes()}\n`);
      return 0;

    case 'paths':
      process.stdout.write(JSON.stringify({ ...loc, plans: path.join(loc.root, 'docs', 'plans') }, null, 2) + '\n');
      return 0;

    case 'init': {
      const r = init(loc, { name: valueOf('--name'), force: flags.has('--force') });
      process.stdout.write(
        `Ledger at ${r.ledger}\nproject: ${r.name}\nwritten: ${r.written.join(', ') || '(none)'}\n` +
        `left alone: ${r.skipped.join(', ') || '(none)'}\n.gitattributes: ${r.gitattributes}\n`);
      return 0;
    }

    case 'next-id': {
      const prefix = (positional[1] || '').toUpperCase().replace(/[^A-Z]/g, '');
      const m = load(loc);
      const id = prefix === 'M' ? nextMilestone(m) : nextId(m, prefix);
      if (!id) { process.stderr.write('usage: sp.js next-id <F|D|U|L|R|M>\n'); return 2; }
      process.stdout.write(id + '\n');
      return 0;
    }

    case 'check': {
      const m = load(loc);
      const findings = check(m);
      const errs = findings.filter((f) => f.level === 'error');
      if (!findings.length) { process.stdout.write('Ledger check: clean.\n'); return 0; }
      for (const f of findings) process.stdout.write(`[${f.level}] ${f.msg}\n        fix: ${f.fix || '—'}\n`);
      process.stdout.write(`\n${errs.length} error(s), ${findings.length - errs.length} warning(s).\n`);
      return errs.length ? 1 : 0;
    }

    case 'status': {
      const m = load(loc);
      if (flags.has('--json')) { process.stdout.write(toJson(m) + '\n'); return 0; }
      if (flags.has('--brief')) {
        const b = brief(m);
        process.stdout.write(b ? b + '\n' : 'No SuperProj ledger here.\n');
        return 0;
      }
      process.stdout.write(statusMd(m) + '\n');
      return 0;
    }

    default:
      process.stderr.write(
        'sp.js — SuperProj ledger engine\n\n' +
        'usage: node sp.js <init|status|check|next-id|today|paths> [options]\n' +
        '  init   [--name "X"] [--force]\n' +
        '  status [--brief|--json]\n' +
        '  check\n' +
        '  next-id <F|D|U|L|R|M>\n' +
        '  today\n' +
        '  paths\n\n' +
        'global: --cwd <dir>\n');
      return 2;
  }
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write('sp.js failed: ' + (err && err.stack || err) + '\n');
    process.exitCode = 3;
  }
}

module.exports = { locate, load, check, brief, statusMd, toJson, nextId, nextMilestone, init, isoDate, isoMinutes, STATUSES };
