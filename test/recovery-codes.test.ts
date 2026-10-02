import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RecoveryCodes from '~/components/auth/RecoveryCodes.vue'

describe('the recovery codes', () => {
  it('lists every code and gates Continue on the checkbox', async () => {
    const view = await mountSuspended(RecoveryCodes, { props: { codes: ['aaaaa-bbbbb', 'ccccc-ddddd'] } })
    expect(view.text()).toContain('aaaaa-bbbbb')
    expect(view.text()).toContain('ccccc-ddddd')
    const proceed = () => view.findAll('button').find(b => b.text() === 'Continue')!
    expect(proceed().attributes('disabled')).toBeDefined()
    await view.find('input[type="checkbox"], button[role="checkbox"]').trigger('click')
    expect(proceed().attributes('disabled')).toBeUndefined()
    await proceed().trigger('click')
    expect(view.emitted('done')).toHaveLength(1)
  })
})
