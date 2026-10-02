import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { fakeAuth } from './fake-auth'
import { readChallenge, rememberChallenge, forgetChallenge, challengePath } from '~/utils/sign-in-challenge'
import ResetPage from '~/pages/auth/reset/[token].vue'

const fake = vi.hoisted(() => ({ auth: null as ReturnType<typeof fakeAuth> | null, navigate: vi.fn() }))
mockNuxtImport('useFleetless', () => () => ({ auth: fake.auth }))
mockNuxtImport('navigateTo', () => fake.navigate)

describe('the pending challenge', () => {
  beforeEach(() => sessionStorage.clear())

  it('survives a read, so a reload keeps the step, and goes on forget', () => {
    expect(rememberChallenge({ status: 'two_factor_required', challenge: 'ch-1', next: '/robots/x' })).toBe(true)
    expect(readChallenge()).toEqual({ status: 'two_factor_required', challenge: 'ch-1', next: '/robots/x' })
    expect(readChallenge()).not.toBeNull()
    forgetChallenge()
    expect(readChallenge()).toBeNull()
  })

  it('reads nothing from a malformed or foreign entry', () => {
    sessionStorage.setItem('fleetless-sign-in-challenge', '{"status":"signed_in","challenge":"x"}')
    expect(readChallenge()).toBeNull()
    sessionStorage.setItem('fleetless-sign-in-challenge', 'not json')
    expect(readChallenge()).toBeNull()
  })

  it('names one page per status', () => {
    expect(challengePath('two_factor_required')).toBe('/auth/two-factor')
    expect(challengePath('two_factor_setup_required')).toBe('/auth/two-factor/setup')
  })
})

describe('a token page through the sign-in result', () => {
  beforeEach(() => {
    sessionStorage.clear()
    fake.auth = fakeAuth()
    fake.navigate.mockReset()
  })

  async function submitReset() {
    const page = await mountSuspended(ResetPage, { route: '/auth/reset/tok-1' })
    await page.find('input[type="password"]').setValue('a-long-new-password')
    await page.find('form').trigger('submit')
    await flushPromises()
    return page
  }

  it('signed_in: reads who that is and lands on the robots', async () => {
    fake.auth!.confirmPasswordReset.mockResolvedValue({ status: 'signed_in' })
    await submitReset()
    expect(fake.auth!.confirmPasswordReset).toHaveBeenCalledWith('tok-1', 'a-long-new-password')
    expect(fake.auth!.me).toHaveBeenCalled()
    expect(fake.navigate).toHaveBeenCalledWith('/robots')
    expect(readChallenge()).toBeNull()
  })

  it('two_factor_required: keeps the challenge out of the URL and goes to the challenge page', async () => {
    fake.auth!.confirmPasswordReset.mockResolvedValue({ status: 'two_factor_required', challenge: 'ch-2' })
    await submitReset()
    expect(fake.auth!.me).not.toHaveBeenCalled()
    expect(fake.navigate).toHaveBeenCalledWith('/auth/two-factor')
    expect(readChallenge()).toEqual({ status: 'two_factor_required', challenge: 'ch-2', next: '/robots' })
    expect(window.location.href).not.toContain('ch-2')
  })

  it('two_factor_setup_required: goes to setup', async () => {
    fake.auth!.confirmPasswordReset.mockResolvedValue({ status: 'two_factor_setup_required', challenge: 'ch-3' })
    await submitReset()
    expect(fake.navigate).toHaveBeenCalledWith('/auth/two-factor/setup')
  })
})
