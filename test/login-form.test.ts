import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type DOMWrapper } from '@vue/test-utils'
import { fakeAuth, refusal } from './fake-auth'
import { readChallenge } from '~/utils/sign-in-challenge'
import LoginForm from '~/components/auth/LoginForm.vue'
import LoginPage from '~/pages/auth/login.vue'

const fake = vi.hoisted(() => ({ auth: null as ReturnType<typeof fakeAuth> | null, navigate: vi.fn() }))
mockNuxtImport('useFleetless', () => () => ({ auth: fake.auth }))
mockNuxtImport('navigateTo', () => fake.navigate)

beforeEach(() => {
  sessionStorage.clear()
  fake.auth = fakeAuth()
  fake.navigate.mockReset()
})

const button = (w: Awaited<ReturnType<typeof mountSuspended>>, label: string) => w.findAll('button').find((b: DOMWrapper<Element>) => b.text() === label)

describe('the sign-in form per method', () => {
  it('password only: today\'s form, no code link', async () => {
    const form = await mountSuspended(LoginForm)
    await flushPromises()
    expect(form.find('input[type="password"]').exists()).toBe(true)
    expect(button(form, 'Email me a sign-in code instead')).toBeUndefined()
  })

  it('methods unreadable → password form', async () => {
    fake.auth!.signInMethods.mockRejectedValue(new TypeError('Failed to fetch'))
    const form = await mountSuspended(LoginForm)
    await flushPromises()
    expect(form.find('input[type="password"]').exists()).toBe(true)
  })

  it('both: password, plus the code link', async () => {
    fake.auth!.signInMethods.mockResolvedValue({ password: true, emailCode: true })
    const form = await mountSuspended(LoginForm)
    await flushPromises()
    expect(form.find('input[type="password"]').exists()).toBe(true)
    expect(button(form, 'Email me a sign-in code instead')).toBeDefined()
  })

  it('code only: no password field, and "Email me a code"', async () => {
    fake.auth!.signInMethods.mockResolvedValue({ password: false, emailCode: true })
    const form = await mountSuspended(LoginForm)
    await flushPromises()
    expect(form.find('input[type="password"]').exists()).toBe(false)
    expect(button(form, 'Email me a code')).toBeDefined()
  })
})

describe('code sign-in', () => {
  beforeEach(() => fake.auth!.signInMethods.mockResolvedValue({ password: false, emailCode: true }))

  async function requestCode(email: string) {
    const form = await mountSuspended(LoginForm, { props: { next: '/robots/r1' } })
    await flushPromises()
    await form.find('input[type="email"]').setValue(email)
    await form.find('form').trigger('submit')
    await flushPromises()
    return form
  }

  async function enter(form: Awaited<ReturnType<typeof mountSuspended>>, code: string) {
    form.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', code)
    await form.find('form').trigger('submit')
    await flushPromises()
  }

  it('trims the address once, for both calls', async () => {
    fake.auth!.verifyLoginCode.mockResolvedValue({ status: 'signed_in' })
    const form = await requestCode('  ann@example.com ')
    expect(fake.auth!.requestLoginCode).toHaveBeenCalledWith('ann@example.com')
    expect(form.text()).toContain('We sent a 6-digit code to ann@example.com. It works for 10 minutes.')
    await enter(form, '123456')
    expect(fake.auth!.verifyLoginCode).toHaveBeenCalledWith('ann@example.com', '123456')
    expect(form.emitted('signedIn')).toHaveLength(1)
  })

  it('counts down to Resend, then sends again', async () => {
    vi.useFakeTimers()
    try {
      const form = await requestCode('ann@example.com')
      expect(form.text()).toMatch(/Resend code in 1:00|Resend code in 0:59/)
      await vi.advanceTimersByTimeAsync(60_000)
      await button(form, 'Resend')!.trigger('click')
      await flushPromises()
      expect(fake.auth!.requestLoginCode).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a dead code offers resend at once', async () => {
    fake.auth!.verifyLoginCode.mockRejectedValue(refusal('token_spent', undefined, 410))
    const form = await requestCode('ann@example.com')
    await enter(form, '123456')
    expect(form.text()).toContain('That code expired. Request a new one.')
    expect(button(form, 'Resend')).toBeDefined()
  })

  it('a challenged code sign-in goes to the second factor with next kept', async () => {
    fake.auth!.verifyLoginCode.mockResolvedValue({ status: 'two_factor_required', challenge: 'ch-5' })
    const form = await requestCode('ann@example.com')
    await enter(form, '123456')
    expect(fake.navigate).toHaveBeenCalledWith('/auth/two-factor')
    expect(readChallenge()).toEqual({ status: 'two_factor_required', challenge: 'ch-5', next: '/robots/r1' })
    expect(form.emitted('signedIn')).toBeUndefined()
  })
})

describe('password sign-in through the result', () => {
  it('a challenged password sign-in goes to setup, not to signedIn', async () => {
    fake.auth!.login.mockResolvedValue({ status: 'two_factor_setup_required', challenge: 'ch-6' })
    const form = await mountSuspended(LoginForm, { props: { next: '/mcp/i1' } })
    await flushPromises()
    await form.find('input[type="email"]').setValue('ann@example.com')
    await form.find('input[type="password"]').setValue('pw')
    await form.find('form').trigger('submit')
    await flushPromises()
    expect(fake.navigate).toHaveBeenCalledWith('/auth/two-factor/setup')
    expect(readChallenge()?.next).toBe('/mcp/i1')
    expect(form.emitted('signedIn')).toBeUndefined()
  })
})

describe('the login page', () => {
  it('says why when a challenge expired', async () => {
    const page = await mountSuspended(LoginPage, { route: '/auth/login?reason=expired' })
    await flushPromises()
    expect(page.text()).toContain('That sign-in step expired. Sign in again.')
  })
})
