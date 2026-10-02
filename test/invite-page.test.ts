import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { fakeAuth } from './fake-auth'
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
    fake.auth!.signInMethods.mockResolvedValue({ password: false, emailCode: true })
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
    fake.auth!.signInMethods.mockResolvedValue({ password: false, emailCode: true })
    fake.auth!.acceptInvitation.mockResolvedValue({ status: 'two_factor_setup_required', challenge: 'ch-7' })
    const page = await mountSuspended(InvitePage, { route: '/auth/invite/tok-1' })
    await flushPromises()
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(fake.navigate).toHaveBeenCalledWith('/auth/two-factor/setup')
  })
})
