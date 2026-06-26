#!/usr/bin/env node
/**
 * One-command demo launcher (S2.5-3).
 *   npm run demo
 *
 * Boots the full local stack so the PO can click through the flow:
 *   1. migrate the dev SQLite DB (idempotent)
 *   2. seed the realistic Kuwait-Electronics catalog into it
 *   3. start the NestJS API on :3000 (claude=mock by default — offline, no API key)
 *   4. wait for the API health check, then start Expo Web on :8081
 *
 * Open http://localhost:8081 and search e.g. "iPhone 17 Pro Max".
 * If ANTHROPIC_API_KEY is set AND CLAUDE_PROVIDER=anthropic, the API uses live Claude; otherwise mock.
 * Ctrl-C stops everything.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import net from 'node:net';

const ROOT = new URL('..', import.meta.url).pathname;
const MOBILE = ROOT + 'apps/mobile';
const API_PORT = process.env.PORT || '3000';

/** Find a free TCP port starting at `start` (Expo's default 8081 is often taken). */
function freePort(start) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(freePort(start + 1)));
    srv.once('listening', () => {
      const { port } = srv.address();
      srv.close(() => resolve(String(port)));
    });
    srv.listen(start, '127.0.0.1');
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false, ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → exit ${code}`))));
    p.on('error', reject);
  });
}

async function waitForApi(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${API_PORT}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  throw new Error(`API did not become healthy on :${API_PORT} within ${timeoutMs}ms`);
}

const children = [];
function startLong(name, cmd, args, env = {}, cwd = ROOT) {
  const p = spawn(cmd, args, { cwd, stdio: 'inherit', shell: false, env: { ...process.env, ...env } });
  p.on('error', (e) => console.error(`[${name}] ${e.message}`));
  children.push(p);
  return p;
}

function shutdown() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async () => {
  console.log('\n[demo] 1/4 migrating dev DB…');
  await run('npm', ['run', 'migrate', '--workspace', '@bestoffers/api']);

  console.log('\n[demo] 2/4 seeding Kuwait-Electronics catalog…');
  await run('npm', ['run', 'seed', '--workspace', '@bestoffers/api']);

  console.log('\n[demo] 3/4 starting API on :' + API_PORT + ' …');
  startLong('api', 'npm', ['run', 'dev:api'], { PORT: API_PORT });
  await waitForApi();
  console.log('[demo] API healthy on http://localhost:' + API_PORT);

  const webPort = process.env.WEB_PORT || (await freePort(8081));
  console.log('\n[demo] 4/4 starting Expo Web on :' + webPort + ' …');
  console.log('[demo] → open http://localhost:' + webPort + ' and search "iPhone 16" (LIVE X-cite + Blink prices)\n');
  startLong(
    'web',
    'npx',
    ['expo', 'start', '--web', '--port', webPort],
    { EXPO_NO_TELEMETRY: '1', CI: '1' },
    MOBILE,
  ).on('exit', shutdown);
})().catch((err) => {
  console.error('\n[demo] failed:', err.message);
  shutdown();
  process.exit(1);
});
