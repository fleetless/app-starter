import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ParameterForm from '~/components/robot/ParameterForm.vue'

const SCHEMA = { type: 'object', properties: { label: { type: 'string' } } }
const ENUM_SCHEMA = { type: 'object', properties: { level: { type: 'integer', enum: [1, 2, 3], default: 2 } } }

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

  it('offers an integer enum by value, so a picked option submits as a number', async () => {
    const form = await mountSuspended(ParameterForm, {
      props: { schema: ENUM_SCHEMA, submitLabel: 'Send' }
    })

    // Each option carries its own value. Stringified ones would submit "3",
    // which the cloud's `enum.includes` refuses, and the numeric default
    // would match no item and select nothing.
    const select = form.findComponent({ name: 'USelect' })
    expect(select.props('items')).toEqual([{ label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }])
    expect(select.props('modelValue')).toBe(2)

    select.vm.$emit('update:modelValue', 3)
    await flushPromises()
    await form.find('form').trigger('submit')
    await flushPromises()
    expect(form.emitted('submit')).toEqual([[{ level: 3 }]])
  })
})
