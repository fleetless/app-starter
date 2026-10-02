import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CodeInput from '~/components/auth/CodeInput.vue'
import { formatCountdown } from '~/utils/countdown'

describe('the six-digit code input', () => {
  it('keeps a leading zero', async () => {
    let value = ''
    const input = await mountSuspended(CodeInput, {
      props: { 'modelValue': '', 'onUpdate:modelValue': (v: string) => { value = v } }
    })
    input.findComponent({ name: 'UPinInput' }).vm.$emit('update:modelValue', ['0', '1', '2', '3', '4', '5'])
    expect(value).toBe('012345')
  })

  it('drops what is not a digit and stops at six', async () => {
    let value = ''
    const input = await mountSuspended(CodeInput, {
      props: { 'modelValue': '', 'onUpdate:modelValue': (v: string) => { value = v } }
    })
    input.findComponent({ name: 'UPinInput' }).vm.$emit('update:modelValue', ['1', ' ', 'a', '2', '3', '4', '5', '6', '7'])
    expect(value).toBe('123456')
  })
})

describe('formatCountdown', () => {
  it('reads as minutes and two-digit seconds', () => {
    expect(formatCountdown(42)).toBe('0:42')
    expect(formatCountdown(60)).toBe('1:00')
    expect(formatCountdown(5)).toBe('0:05')
  })
})
