#!/usr/bin/env node
/**
 * SessionStart hook: inject a short project-status brief so Claude starts every
 * session knowing where the project stands.
 *
 * Contract: always exit 0 and never block a session. If there is no ledger, or
 * anything at all goes wrong, print nothing and get out of the way.
 */
'use strict';

const path = require('path');

/**
 * Read the hook payload from fd 0. Retries on EAGAIN, which Node raises when
 * stdin is a non-blocking pipe that has no data ready yet. Returns null — not
 * '' — when the payload genuinely could not be read, so the caller can tell
 * "no payload" apart from "payload said startup".
 */
function readStdin() {
  const fs = require('fs');
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return fs.readFileSync(0, 'utf8');
    } catch (err) {
      if (!err || (err.code !== 'EAGAIN' && err.code !== 'EWOULDBLOCK')) return null;
      // Busy-wait briefly; this runs at session start and must not hang.
      const until = Date.now() + 5;
      while (Date.now() < until) { /* spin */ }
    }
  }
  return null;
}

function main() {
  let cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let source = null;

  const raw = readStdin();
  if (raw !== null && raw.trim()) {
    try {
      const payload = JSON.parse(raw);
      if (payload && typeof payload.cwd === 'string' && payload.cwd) cwd = payload.cwd;
      if (payload && typeof payload.source === 'string') source = payload.source;
    } catch { /* not JSON; env/cwd fallback stands */ }
  }

  // Compaction already carries this context in the transcript, so don't
  // re-inject it. An unknown source (payload unreadable) still gets the brief:
  // a duplicated brief costs a few hundred characters, a missing one costs the
  // session its bearings.
  if (source === 'compact') return;

  const sp = require(path.join(__dirname, 'sp.js'));
  const loc = sp.locate(cwd);
  if (!loc.hasLedger) return;

  const model = sp.load(loc);

  // Keep the generated STATE.md honest without relying on anyone remembering.
  // Writes only when the content actually changed, so merely opening a session
  // does not dirty the working tree. A read-only checkout is not an error here.
  try {
    sp.writeState(model);
  } catch { /* the brief still works; never fail a session over a generated file */ }

  let text = sp.brief(model);
  if (!text) return;
  if (text.length > 9000) text = text.slice(0, 9000) + '\n…(truncated)';

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: text,
    },
  }));
}

try {
  main();
} catch {
  // Silence is the correct failure mode for a session-start hook.
}
process.exitCode = 0;
