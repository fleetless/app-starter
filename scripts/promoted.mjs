#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Refuses an @fleetless/sdk version the promotion has not reached yet.
 *
 * Run as `node scripts/promoted.mjs <version>` by sdk-bump.yml, right after
 * it has picked the version to pin. sdk's release publishes a final version
 * under the npm dist-tag `staging` only (spec 2026-10-06-staging-environment
 * §9.6); `latest` moves to it, and never backwards, when that release is
 * promoted to production (fleetless/fleetless promote.yml). A version
 * `staging` carries but `latest` does not is still being tested — pinning it
 * here would ship the public template against a release production has not
 * accepted. `version <= latest` is exactly "promoted".
 *
 * `npm view` failing is NOT treated as "go ahead": a network error and a
 * version that is genuinely unpromoted are both just an absence of proof,
 * and only one of them is safe to proceed on.
 */
import { execFileSync } from 'node:child_process'

const PACKAGE = '@fleetless/sdk'

const version = process.argv[2]
if (!version) {
  console.error('promoted: no version (argv[2])')
  process.exit(2)
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`promoted: "${version}" is not X.Y.Z`)
  process.exit(2)
}

let distTags
try {
  const out = execFileSync('npm', ['view', PACKAGE, 'dist-tags', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  distTags = JSON.parse(out)
} catch (err) {
  const text = `${err.stderr ?? ''}${err.stdout ?? err.message ?? ''}`
  console.error(`promoted: could not read ${PACKAGE}'s dist-tags from the registry; refusing rather than guessing.`)
  console.error(`  ${text.trim().split('\n').slice(0, 4).join('\n  ')}`)
  process.exit(1)
}

const latest = distTags?.latest
if (!latest) {
  console.error(`promoted: the registry lists no \`latest\` for ${PACKAGE}; refusing.`)
  process.exit(1)
}

if (cmpSemver(version, latest) > 0) {
  console.error(`promoted: ${PACKAGE} ${version} is not promoted (latest is ${latest}) — the template pins promoted versions only`)
  process.exit(1)
}

console.error(`promoted: ${PACKAGE} ${version} is promoted (latest is ${latest})`)

/** -1, 0 or 1. Both sides are already asserted X.Y.Z. */
function cmpSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}
