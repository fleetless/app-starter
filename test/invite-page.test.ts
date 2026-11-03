import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { fakeAuth, refusal } from './fake-auth'
import InvitePage from '~/pages/auth/invite/[token].vue'

const fake = vi.hoisted(() => ({ auth: null as ReturnType<typeof fakeAuth> | null, navigate: vi.fn() }))
mockNuxtImport('useFleetless', () => () => ({ auth: fake.auth }))
mockNuxtImport('navigateTo', () => fake.navigate)

describe('accepting an invitation', () => {
  beforeEach(() => {
    sessionStorage.clear()
    fake.auth = fakeAuth()
    fake.navigate.mockReset()
    fake.auth.acceptInvitation.mockResolvedValue({ status: 'signed_in' })
  })

  it('invitation without password: a code-only app asks for no password and sends none', async () => {
    fake.auth!.signInMethods.mockResolvedValue({ password: false, emailCode: true, twoFactor: 'optional' })
    const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
    await flushPromises()
    expect(page.find('input[type="password"]').exists()).toBe(false)
    expect(page.text()).toContain('You sign in with a code we email you — no password.')
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(fake.auth!.acceptInvitation).toHaveBeenCalledWith({ token: 'tok-1', password: undefined, displayName: undefined })
    expect(fake.navigate).toHaveBeenCalledWith('/robots')
  })

  it('a password app still asks for one', async () => {
    const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
    await flushPromises()
    expect(page.find('input[type="password"]').exists()).toBe(true)
  })

  it('a required second factor goes on to setup', async () => {
    fake.auth!.signInMethods.mockResolvedValue({ password: false, emailCode: true, twoFactor: 'optional' })
    fake.auth!.acceptInvitation.mockResolvedValue({ status: 'two_factor_setup_required', challenge: 'ch-7' })
    const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
    await flushPromises()
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(fake.navigate).toHaveBeenCalledWith('/auth/two-factor/setup')
  })

  for (const password of [true, false]) {
    it(`announces required setup before accepting a ${password ? 'password' : 'code-only'} invitation`, async () => {
      fake.auth!.signInMethods.mockResolvedValue({ password, emailCode: !password, twoFactor: 'required' })
      const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
      await flushPromises()
      expect(page.text()).toContain('Next you set up two-factor authentication — Fleetless App requires it.')
      expect(page.find('input[type="password"]').exists()).toBe(password)
      expect(fake.auth!.acceptInvitation).not.toHaveBeenCalled()
    })
  }

  for (const twoFactor of ['off', 'optional'] as const) {
    it(`does not announce setup for policy ${twoFactor}`, async () => {
      fake.auth!.signInMethods.mockResolvedValue({ password: true, emailCode: false, twoFactor })
      const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
      await flushPromises()
      expect(page.text()).not.toContain('Next you set up two-factor authentication')
    })
  }

  it.each([undefined, null, 'bogus'])('blocks acceptance on missing or invalid twoFactor %s until Retry', async (twoFactor) => {
    fake.auth!.signInMethods.mockResolvedValueOnce({ password: true, emailCode: false, twoFactor } as never)
    fake.auth!.signInMethods.mockResolvedValue({ password: false, emailCode: true, twoFactor: 'required' })
    const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
    await flushPromises()
    expect(page.find('form').exists()).toBe(false)
    expect(fake.auth!.acceptInvitation).not.toHaveBeenCalled()
    await page.findAll('button').find(button => button.text() === 'Retry')!.trigger('click')
    await flushPromises()
    expect(page.text()).toContain('Next you set up two-factor authentication — Fleetless App requires it.')
    expect(page.find('input[type="password"]').exists()).toBe(false)
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(fake.auth!.acceptInvitation).toHaveBeenCalledTimes(1)
    expect(fake.auth!.acceptInvitation).toHaveBeenCalledWith({ token: 'tok-1', password: undefined, displayName: undefined })
  })

  it('a failed read blocks acceptance; repeated Retry clicks do not submit', async () => {
    fake.auth!.signInMethods.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
    await flushPromises()
    expect(page.text()).toContain('Could not read this app\'s sign-in methods and two-factor policy. Try again.')
    expect(page.find('form').exists()).toBe(false)
    expect(fake.auth!.acceptInvitation).not.toHaveBeenCalled()
    const retry = page.findAll('button').find(button => button.text() === 'Retry')!
    await retry.trigger('click')
    await retry.trigger('click')
    await flushPromises()
    expect(fake.auth!.acceptInvitation).not.toHaveBeenCalled()
    expect(page.find('form').exists()).toBe(true)
  })

  it('a refused read keeps the refusal\'s own sentence', async () => {
    fake.auth!.signInMethods.mockRejectedValueOnce(refusal('rate_limited', { retry_after_ms: 5000 }, 429))
    const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
    await flushPromises()
    expect(page.text()).toContain('Too many attempts. Try again in 5 seconds.')
    expect(page.text()).not.toContain('Could not read')
    expect(page.find('form').exists()).toBe(false)
    expect(page.findAll('button').some(button => button.text() === 'Retry')).toBe(true)
  })
})
