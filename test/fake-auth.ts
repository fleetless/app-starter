import { vi } from 'vitest'
import { FleetlessError } from '@fleetless/sdk'

/** An `auth` namespace whose every method is a spy; a test overrides what it needs. */
export function fakeAuth() {
  return {
    me: vi.fn(async () => ({ kind: 'app_user', email: 'ann@example.com', two_factor_enabled: false }) as never),
    login: vi.fn(),
    requestLoginCode: vi.fn(async () => {}),
    verifyLoginCode: vi.fn(),
    signInMethods: vi.fn(async () => ({ password: true, emailCode: false })),
    listProviders: vi.fn(async () => []),
    acceptInvitation: vi.fn(),
    verifyEmail: vi.fn(),
    confirmPasswordReset: vi.fn(),
    verifyTwoFactor: vi.fn(async () => {}),
    beginTwoFactorSetup: vi.fn(async () => ({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/App:ann%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=App' })),
    confirmTwoFactorSetup: vi.fn(async () => ({ recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'] })),
    disableTwoFactor: vi.fn(async () => {}),
    resendVerification: vi.fn(async () => {}),
    beginOidcLogin: vi.fn(),
    mcpInteraction: vi.fn()
  }
}

export const refusal = (code: string, details?: unknown, status = 400) =>
  new FleetlessError(code, code, { status, details } as never)
