import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(import.meta.dirname, '..', '..')

async function waitForHealth(baseUrl, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('server did not become healthy in time')
}

// Build the SPA (once) and spawn the server on an isolated port + temp DB.
export async function startServer({ port = 8788, build = false, testMode = true } = {}) {
  if (build || !existsSync(join(ROOT, 'dist', 'index.html'))) {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  }
  const dbPath = join(mkdtempSync(join(tmpdir(), 'cfe-e2e-')), 'cfe.sqlite')
  const child = spawn('node', ['--env-file=.env', 'server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), CFE_DB_PATH: dbPath, ...(testMode ? { CFE_TEST_MODE: '1' } : {}) },
    stdio: 'inherit',
  })
  const baseUrl = `http://localhost:${port}`
  await waitForHealth(baseUrl)
  return {
    baseUrl,
    stop: () => new Promise((resolve) => {
      child.once('exit', resolve)
      child.kill('SIGTERM')
    }),
  }
}
