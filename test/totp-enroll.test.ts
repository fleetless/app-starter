import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { fakeAuth, refusal } from './fake-auth'
import TotpEnroll from '~/components/auth/TotpEnroll.vue'

const fake = vi.hoisted(() => ({ auth: null as ReturnType<typeof fakeAuth> | null }))
mockNuxtImport('useFleetless', () => () => ({ auth: fake.auth }))

describe('enrolling an authenticator', () => {
  beforeEach(() => {
    fake.auth = fakeAuth()
  })

  it('shows the key and a QR, confirms with the code and hands the recovery codes up', async () => {
    const enroll = await mountSuspended(TotpEnroll, { props: { challenge: 'ch-1' } })
    await flushPromises()
    expect(fake.auth!.beginTwoFactorSetup).toHaveBeenCalledWith({ challenge: 'ch-1' })
    expect(enroll.text()).toContain('JBSWY3DPEHPK3PXP')
    expect(enroll.find('img').attributes('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    enroll.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', '123456')
    await enroll.find('form').trigger('submit')
    await flushPromises()
    expect(fake.auth!.confirmTwoFactorSetup).toHaveBeenCalledWith({ code: '123456', challenge: 'ch-1' })
    expect(enroll.emitted('confirmed')?.[0]).toEqual([['aaaaa-bbbbb', 'ccccc-ddddd']])
  })

  it('from account settings sends no challenge, and a wrong code stays on the page', async () => {
    fake.auth!.confirmTwoFactorSetup.mockRejectedValue(refusal('invalid_code', { attempts_left: 0 }))
    const enroll = await mountSuspended(TotpEnroll, { props: {} })
    await flushPromises()
    expect(fake.auth!.beginTwoFactorSetup).toHaveBeenCalledWith({})
    enroll.findComponent({ name: 'AuthCodeInput' }).vm.$emit('update:modelValue', '000000')
    await enroll.find('form').trigger('submit')
    await flushPromises()
    expect(enroll.text()).toContain('That code is incorrect.')
    expect(enroll.emitted('failed')).toBeUndefined()
  })

  it('a refused start goes up to the page that knows what it means', async () => {
    fake.auth!.beginTwoFactorSetup.mockRejectedValue(refusal('target_state_conflict', { fields: [{ field: 'two_factor', rule: 'off' }] }, 409))
    const enroll = await mountSuspended(TotpEnroll, { props: {} })
    await flushPromises()
    expect(enroll.emitted('failed')).toHaveLength(1)
  })
})
