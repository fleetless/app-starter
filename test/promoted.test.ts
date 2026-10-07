// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * `scripts/promoted.mjs` is the gate `sdk-bump.yml` runs before it ever pins
 * an sdk version: a version npm's `staging` dist-tag carries but `latest`
 * does not is still being tested in staging, not yet promoted to production
 * (spec 2026-10-06-staging-environment §9.6). `npm` on `PATH` is a stub that
 * prints a fixed `dist-tags` document, or fails outright for the registry-error
 * case; a real release workflow talks to the real registry.
 *
 * The path below is built from `fileURLToPath` plus `path.join`, not a
 * literal `new URL('../scripts/...', import.meta.url)`: Vite's asset-URL
 * transform rewrites that exact pattern and resolves it to the wrong file
 * under vitest's `nuxt` environment.
 */

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'promoted.mjs')

interface Run {
  status: number
  stdout: string
  stderr: string
}

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function run(version: string | null, npmBehavior: 'ok' | 'fail' | 'no-latest', distTags: Record<string, string> = {}): Run {
  const dir = mkdtempSync(join(tmpdir(), 'promoted-'))
  dirs.push(dir)
  const bin = join(dir, 'bin')
  mkdirSync(bin)

  if (npmBehavior === 'fail') {
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\necho "npm ERR! 404 Not Found" >&2\nexit 1\n')
  } else {
    const tags = npmBehavior === 'no-latest' ? {} : distTags
    writeFileSync(join(bin, 'npm'), `#!/bin/sh\ncat <<'EOF'\n${JSON.stringify(tags)}\nEOF\n`)
  }
  chmodSync(join(bin, 'npm'), 0o755)

  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` }
  const child = spawnSync(process.execPath, [SCRIPT, ...(version === null ? [] : [version])], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return { status: child.status ?? -1, stdout: child.stdout, stderr: child.stderr }
}

describe('promoted refuses an @fleetless/sdk version the promotion has not reached', () => {
  it('a version at latest is promoted', () => {
    const r = run('4.5.0', 'ok', { latest: '4.5.0' })

    expect(r.status).toBe(0)
    expect(r.stderr).toContain('4.5.0 is promoted (latest is 4.5.0)')
  })

  it('a version below latest is promoted', () => {
    const r = run('4.4.0', 'ok', { latest: '4.5.0' })

    expect(r.status).toBe(0)
  })

  it('a version above latest — published under `staging` only — is refused', () => {
    const r = run('4.6.0', 'ok', { latest: '4.5.0', staging: '4.6.0' })

    expect(r.status).toBe(1)
    expect(r.stderr).toContain('@fleetless/sdk 4.6.0 is not promoted (latest is 4.5.0) — the template pins promoted versions only')
  })

  it('a registry error is refused, never treated as "go ahead"', () => {
    const r = run('4.5.0', 'fail')

    expect(r.status).toBe(1)
    expect(r.stderr).toContain('could not read')
  })

  it('no `latest` on the registry is refused', () => {
    const r = run('4.5.0', 'no-latest')

    expect(r.status).toBe(1)
    expect(r.stderr).toContain('lists no `latest`')
  })

  it('no version at all exits 2: a caller bug, not an unpromoted version', () => {
    const r = run(null, 'ok', { latest: '4.5.0' })

    expect(r.status).toBe(2)
  })

  it('a version that is not X.Y.Z exits 2', () => {
    const r = run('4.5.0-next.1', 'ok', { latest: '4.5.0' })

    expect(r.status).toBe(2)
  })
})
