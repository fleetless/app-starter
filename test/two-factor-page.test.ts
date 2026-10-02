import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { fakeAuth, refusal } from './fake-auth'
import { readChallenge, rememberChallenge } from '~/utils/sign-in-challenge'
import ChallengePage from '~/pages/auth/two-factor/index.vue'
import SetupPage from '~/pages/auth/two-factor/setup.vue'

const fake = vi.hoisted(() => ({ auth: null as ReturnType<typeof fakeAuth> | null, navigate: vi.fn() }))
mockNuxtImport('useFleetless', () => () => ({ auth: fake.auth }))
mockNuxtImport('navigateTo', () => fake.navigate)

beforeEach(() => {
  sessionStorage.clear()
  fake.auth = fakeAuth()
  fake.navigate.mockReset()
})

async function typeCode(page: Awaited<ReturnType<typeof mountSuspended>>, code: string) {
  page.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', code)
  await page.find('form').trigger('submit')
  await flushPromises()
}

describe('/auth/two-factor', () => {
  it('nothing pending goes to login and calls nothing', async () => {
    await mountSuspended(ChallengePage, { route: '/auth/two-factor' })
    await flushPromises()
    expect(fake.navigate).toHaveBeenCalledWith('/auth/login')
    expect(fake.auth!.verifyTwoFactor).not.toHaveBeenCalled()
  })

  it('the second sign-in: a code signs in and lands where the sign-in was headed', async () => {
    rememberChallenge({ status: 'two_factor_required', challenge: 'ch-1', next: '/robots/r1' })
    const page = await mountSuspended(ChallengePage, { route: '/auth/two-factor' })
    await typeCode(page, '123456')
    expect(fake.auth!.verifyTwoFactor).toHaveBeenCalledWith({ challenge: 'ch-1', code: '123456' })
    expect(fake.auth!.me).toHaveBeenCalled()
    expect(fake.navigate).toHaveBeenCalledWith('/robots/r1')
    expect(readChallenge()).toBeNull()
  })

  it('a stored next that leaves the app lands on the robots instead', async () => {
    rememberChallenge({ status: 'two_factor_required', challenge: 'ch-1', next: '//evil.example' })
    const page = await mountSuspended(ChallengePage, { route: '/auth/two-factor' })
    await typeCode(page, '123456')
    expect(fake.navigate).toHaveBeenCalledWith('/robots')
  })

  it('a recovery code signs in the same way', async () => {
    rememberChallenge({ status: 'two_factor_required', challenge: 'ch-1', next: '/robots' })
    const page = await mountSuspended(ChallengePage, { route: '/auth/two-factor' })
    await page.findAll('button').find(b => b.text() === 'Use a recovery code')!.trigger('click')
    await page.find('input[name="recovery_code"]').setValue('  aaaaa-bbbbb ')
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(fake.auth!.verifyTwoFactor).toHaveBeenCalledWith({ challenge: 'ch-1', recoveryCode: 'aaaaa-bbbbb' })
  })

  it('a wrong code says how many attempts are left and stays', async () => {
    rememberChallenge({ status: 'two_factor_required', challenge: 'ch-1' })
    fake.auth!.verifyTwoFactor.mockRejectedValue(refusal('invalid_code', { attempts_left: 2 }))
    const page = await mountSuspended(ChallengePage, { route: '/auth/two-factor' })
    await typeCode(page, '000000')
    expect(page.text()).toContain('That code is incorrect. 2 attempts left.')
    expect(fake.navigate).not.toHaveBeenCalled()
  })

  it('a dead challenge restarts sign-in, saying why', async () => {
    rememberChallenge({ status: 'two_factor_required', challenge: 'ch-1', next: '/mcp/i1' })
    fake.auth!.verifyTwoFactor.mockRejectedValue(refusal('invalid_code', { attempts_left: 0 }))
    const page = await mountSuspended(ChallengePage, { route: '/auth/two-factor' })
    await typeCode(page, '000000')
    expect(fake.navigate).toHaveBeenCalledWith({ path: '/auth/login', query: { reason: 'expired', next: '/mcp/i1' } })
    expect(readChallenge()).toBeNull()
  })
})

describe('/auth/two-factor/setup', () => {
  it('required setup at first sign-in: enrol, save codes, then land', async () => {
    rememberChallenge({ status: 'two_factor_setup_required', challenge: 'ch-9', next: '/robots' })
    const page = await mountSuspended(SetupPage, { route: '/auth/two-factor/setup' })
    await flushPromises()
    expect(page.text()).toContain('requires it for every account')
    await typeCode(page, '123456')
    expect(fake.auth!.confirmTwoFactorSetup).toHaveBeenCalledWith({ code: '123456', challenge: 'ch-9' })
    expect(page.text()).toContain('Save your recovery codes')
    expect(readChallenge()).toBeNull() // spent: a reload must not retry it
    await page.find('input[type="checkbox"], button[role="checkbox"]').trigger('click')
    await page.findAll('button').find(b => b.text() === 'Continue')!.trigger('click')
    await flushPromises()
    expect(fake.auth!.me).toHaveBeenCalled()
    expect(fake.navigate).toHaveBeenCalledWith('/robots')
  })

  it('a challenge of the other kind is not set up here', async () => {
    rememberChallenge({ status: 'two_factor_required', challenge: 'ch-1' })
    await mountSuspended(SetupPage, { route: '/auth/two-factor/setup' })
    await flushPromises()
    expect(fake.navigate).toHaveBeenCalledWith('/auth/two-factor')
    expect(fake.auth!.beginTwoFactorSetup).not.toHaveBeenCalled()
  })
})
