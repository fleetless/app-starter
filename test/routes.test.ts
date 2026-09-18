import { describe, expect, it } from 'vitest'
import { isPublicPath } from '~/utils/routes'

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
