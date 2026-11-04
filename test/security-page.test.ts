import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type DOMWrapper } from '@vue/test-utils'
import type { SignInMethods } from '@fleetless/sdk'
import { fakeAuth, refusal } from './fake-auth'
import SecurityPage from '~/pages/account/security.vue'

const fake = vi.hoisted(() => ({ auth: null as ReturnType<typeof fakeAuth> | null, navigate: vi.fn() }))
mockNuxtImport('useFleetless', () => () => ({ auth: fake.auth }))
mockNuxtImport('navigateTo', () => fake.navigate)

const me = (enabled: boolean) => ({ kind: 'app_user', email: 'ann@example.com', two_factor_enabled: enabled }) as never
const conflict = (rule: string) => refusal('target_state_conflict', { fields: [{ field: 'two_factor', rule, message: 'm' }] }, 409)
const button = (w: Awaited<ReturnType<typeof mountSuspended>>, label: string) => w.findAll('button').find((b: DOMWrapper<Element>) => b.text() === label)

async function mountWith(enabled: boolean) {
  fake.auth!.me.mockResolvedValue(me(enabled))
  const { onSignedIn } = useSession()
  await onSignedIn() // seeds identity as the middleware would
  const page = await mountSuspended(SecurityPage, { route: '/account/security' })
  await flushPromises()
  return page
}

describe('Account › Security', () => {
  beforeEach(() => {
    fake.auth = fakeAuth()
    fake.navigate.mockReset()
  })

  for (const [policy, enrolled, visible, action] of [
    ['off', false, false, null],
    ['off', true, true, 'Turn off'],
    ['optional', false, true, 'Set up'],
    ['optional', true, true, 'Turn off'],
    ['required', false, true, 'Set up'],
    ['required', true, true, null]
  ] as const) {
    it(`${policy} with enrollment ${enrolled} shows the allowed Security action`, async () => {
      fake.auth!.signInMethods.mockResolvedValue({ password: true, emailCode: false, twoFactor: policy } as never)
      const page = await mountWith(enrolled)
      expect(page.text().includes('Two-factor authentication')).toBe(visible)
      expect(page.text().includes('Required by')).toBe(policy === 'required')
      expect(Boolean(button(page, 'Set up'))).toBe(action === 'Set up')
      expect(Boolean(button(page, 'Turn off'))).toBe(action === 'Turn off')
    })
  }

  it.each([undefined, null, 'bogus'])('missing or invalid twoFactor %s fails closed until Retry', async (twoFactor) => {
    fake.auth!.signInMethods.mockResolvedValueOnce({ password: true, emailCode: false, twoFactor } as never)
    fake.auth!.signInMethods.mockResolvedValue({ password: true, emailCode: false, twoFactor: 'optional' } as never)
    const page = await mountWith(false)
    expect(page.text()).toContain('policy')
    expect(button(page, 'Retry')).toBeDefined()
    expect(button(page, 'Set up')).toBeUndefined()
    expect(button(page, 'Turn off')).toBeUndefined()
    await button(page, 'Retry')!.trigger('click')
    await flushPromises()
    expect(button(page, 'Set up')).toBeDefined()
  })

  it('twoFactor null is a failed read, never off: an enrolled person gets no Turn off', async () => {
    fake.auth!.signInMethods.mockResolvedValueOnce({ password: true, emailCode: false, twoFactor: null } as never)
    const page = await mountWith(true)
    expect(page.text()).toContain('Could not read this app\'s two-factor policy. Try again.')
    expect(page.text()).not.toContain('Two-factor authentication')
    expect(button(page, 'Turn off')).toBeUndefined()
    expect(button(page, 'Retry')).toBeDefined()
  })

  it('a rejected policy read has no action until Retry succeeds', async () => {
    fake.auth!.signInMethods.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const page = await mountWith(true)
    expect(page.text()).toContain('Could not read this app\'s two-factor policy. Try again.')
    expect(button(page, 'Turn off')).toBeUndefined()
    expect(button(page, 'Retry')).toBeDefined()
    await button(page, 'Retry')!.trigger('click')
    await flushPromises()
    expect(button(page, 'Turn off')).toBeDefined()
  })

  it.each([
    ['rate_limited', { retry_after_ms: 5000 }, 429, 'Too many attempts. Try again in 5 seconds.'],
    ['not_found', undefined, 404, 'That does not exist, or you cannot reach it.'],
    ['internal_error', undefined, 500, 'Could not read this app\'s two-factor policy. Try again.'],
    ['unparseable_error', undefined, 502, 'Could not read this app\'s two-factor policy. Try again.'],
    ['unexpected_response', undefined, 200, 'Could not read this app\'s two-factor policy. Try again.']
  ])('a %s read says its own sentence, or the page\'s', async (code, details, status, sentence) => {
    fake.auth!.signInMethods.mockRejectedValueOnce(refusal(code, details, status))
    const page = await mountWith(false)
    expect(page.text()).toContain(sentence)
    expect(page.text()).not.toContain('The request was refused')
    expect(button(page, 'Set up')).toBeUndefined()
    expect(button(page, 'Retry')).toBeDefined()
  })

  it('overlapping reads: only the latest lands, a slower earlier one is dropped', async () => {
    fake.auth!.signInMethods.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const page = await mountWith(true)
    const reads: ((methods: SignInMethods) => void)[] = []
    fake.auth!.signInMethods.mockImplementation(() => new Promise(resolve => reads.push(resolve)))
    const retry = button(page, 'Retry')!
    await retry.trigger('click')
    await retry.trigger('click')
    expect(reads).toHaveLength(2)
    reads[1]!({ password: true, emailCode: false, twoFactor: 'optional' })
    await flushPromises()
    reads[0]!({ password: true, emailCode: false, twoFactor: 'required' })
    await flushPromises()
    expect(page.text()).not.toContain('Required by')
    expect(button(page, 'Turn off')).toBeDefined()
  })

  it('optional: Set up enrols, shows the codes once, then reads On', async () => {
    const page = await mountWith(false)
    expect(page.text()).toContain('Off')
    await button(page, 'Set up')!.trigger('click')
    await flushPromises()
    expect(fake.auth!.beginTwoFactorSetup).toHaveBeenCalledWith({})
    page.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', '123456')
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(page.text()).toContain('aaaaa-bbbbb')
    fake.auth!.me.mockResolvedValue(me(true))
    await page.find('input[type="checkbox"], button[role="checkbox"]').trigger('click')
    await button(page, 'Continue')!.trigger('click')
    await flushPromises()
    expect(page.text()).toContain('On')
    expect(button(page, 'Turn off')).toBeDefined()
  })

  it('policy changes to off before setup: refresh hides the card', async () => {
    fake.auth!.beginTwoFactorSetup.mockRejectedValue(conflict('off'))
    fake.auth!.signInMethods.mockResolvedValueOnce({ password: true, emailCode: false, twoFactor: 'optional' })
      .mockResolvedValue({ password: true, emailCode: false, twoFactor: 'off' })
    const page = await mountWith(false)
    await button(page, 'Set up')!.trigger('click')
    await flushPromises()
    expect(page.text()).not.toContain('Two-factor authentication')
    expect(button(page, 'Set up')).toBeUndefined()
  })

  it('on: Turn off with the current code', async () => {
    const page = await mountWith(true)
    await button(page, 'Turn off')!.trigger('click')
    page.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', '654321')
    fake.auth!.me.mockResolvedValue(me(false))
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(fake.auth!.disableTwoFactor).toHaveBeenCalledWith('654321')
    expect(page.text()).toContain('Off')
  })

  it('policy changes to required before turn-off: refresh shows Required by <app>', async () => {
    fake.auth!.disableTwoFactor.mockRejectedValue(conflict('required'))
    fake.auth!.signInMethods.mockResolvedValueOnce({ password: true, emailCode: false, twoFactor: 'optional' })
      .mockResolvedValue({ password: true, emailCode: false, twoFactor: 'required' })
    const page = await mountWith(true)
    await button(page, 'Turn off')!.trigger('click')
    page.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', '654321')
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(page.text()).toMatch(/Required by /)
    expect(page.text()).not.toContain('is missing in the console')
    expect(button(page, 'Turn off')).toBeUndefined()
  })

  it('a wrong current code stays on the form', async () => {
    fake.auth!.disableTwoFactor.mockRejectedValue(refusal('invalid_code'))
    const page = await mountWith(true)
    await button(page, 'Turn off')!.trigger('click')
    page.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', '000000')
    await page.find('form').trigger('submit')
    await flushPromises()
    expect(page.text()).toContain('That code is incorrect.')
  })
})
