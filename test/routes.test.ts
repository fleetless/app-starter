import { describe, expect, it } from 'vitest'
import { isPublicPath, safeNext } from '~/utils/routes'

describe('isPublicPath', () => {
  it('lets every auth page and the MCP consent page through without a session', () => {
    for (const path of ['/auth/login', '/auth/register', '/auth/verify/abc', '/auth/reset/abc', '/auth/invite/abc', '/auth/callback', '/auth/forgot', '/mcp/abc']) {
      expect(isPublicPath(path), path).toBe(true)
    }
  })

  it('keeps everything else behind a session', () => {
    for (const path of ['/', '/robots', '/robots/abc', '/account', '/account/connections', '/authx']) {
      expect(isPublicPath(path), path).toBe(false)
    }
  })
})

describe('safeNext', () => {
  it('hands back a path inside this app', () => {
    for (const path of ['/robots/abc', '/account/connections', '/']) {
      expect(safeNext(path), path).toBe(path)
    }
  })

  it('refuses anything that could leave this app, whitespace and all', () => {
    // `//evil.com` and `/\evil.com` read as external to the router, which
    // throws rather than navigating — and a throw inside a click handler
    // makes a successful sign-in look like it did nothing.
    for (const raw of ['//evil.com', '/\\evil.com', '/ \\evil.com', '/ //evil.com', 'https://evil.com', 'robots', undefined, null, '', 42]) {
      expect(safeNext(raw), String(raw)).toBe('/robots')
    }
  })
})
