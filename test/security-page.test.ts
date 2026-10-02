import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type DOMWrapper } from '@vue/test-utils'
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

  it('off: Set up enrols, shows the codes once, then reads On', async () => {
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

  it('policy off: the refused setup becomes a statement, and the button goes', async () => {
    fake.auth!.beginTwoFactorSetup.mockRejectedValue(conflict('off'))
    const page = await mountWith(false)
    await button(page, 'Set up')!.trigger('click')
    await flushPromises()
    expect(page.text()).toContain('does not offer two-factor.')
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

  it('policy required: the refused turn-off reads Required by <app>, not a generic error', async () => {
    fake.auth!.disableTwoFactor.mockRejectedValue(conflict('required'))
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
