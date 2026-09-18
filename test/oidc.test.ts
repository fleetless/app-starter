import { beforeEach, describe, expect, it } from 'vitest'
import { rememberOidc, takeOidc } from '~/utils/oidc'

describe('the OIDC round trip memory', () => {
  beforeEach(() => sessionStorage.clear())

  it('hands back what was remembered exactly once', () => {
    rememberOidc('state-1', 'verifier-1')
    expect(takeOidc()).toEqual({ state: 'state-1', verifier: 'verifier-1' })
    expect(takeOidc()).toBeNull()
  })

  it('answers null when nothing was remembered', () => {
    expect(takeOidc()).toBeNull()
  })
})
