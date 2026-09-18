import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ParameterForm from '~/components/robot/ParameterForm.vue'

const SCHEMA = { type: 'object', properties: { label: { type: 'string' } } }

describe('RobotParameterForm', () => {
  it('lets the next submit through once the person edits past a server refusal', async () => {
    const form = await mountSuspended(ParameterForm, {
      props: {
        schema: SCHEMA,
        submitLabel: 'Send',
        fieldErrors: [{ name: 'label', message: 'The cloud refused that.' }]
      }
    })

    // The refusal stands, so UForm withholds the submit event.
    await form.find('form').trigger('submit')
    await flushPromises()
    expect(form.emitted('submit')).toBeUndefined()

    // Editing makes the verdict stale; the same submit now reaches the parent.
    await form.find('input').setValue('corrected')
    await flushPromises()
    await form.find('form').trigger('submit')
    await flushPromises()
    expect(form.emitted('submit')).toEqual([[{ label: 'corrected' }]])
  })
})
