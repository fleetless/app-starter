import { describe, expect, it } from 'vitest'
import { fieldsFrom, initialValues, toParams, validateValues } from '~/utils/json-schema-form'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['order', 'mode'],
  properties: {
    order: { type: 'integer', minimum: 1, maximum: 25, description: 'How many.' },
    speed: { type: 'number', minimum: -1, maximum: 1, default: 0.5 },
    mode: { type: 'string', enum: ['slow', 'fast'] },
    label: { type: 'string', pattern: '^[a-z]+$' },
    armed: { type: 'boolean', default: false },
    pose: { type: 'object', properties: { x: { type: 'number' } } }
  }
}

describe('fieldsFrom', () => {
  it('maps every property to a field with its kind, bounds and requiredness', () => {
    const fields = fieldsFrom(SCHEMA)
    expect(fields.map(f => [f.name, f.kind, f.required])).toEqual([
      ['order', 'integer', true],
      ['speed', 'number', false],
      ['mode', 'enum', true],
      ['label', 'string', false],
      ['armed', 'boolean', false],
      ['pose', 'json', false]
    ])
    expect(fields[0]).toMatchObject({ min: 1, max: 25, description: 'How many.' })
    expect(fields[2]).toMatchObject({ options: ['slow', 'fast'] })
    expect(fields[3]).toMatchObject({ pattern: '^[a-z]+$' })
  })

  it('answers no fields for null or a schema with no properties', () => {
    expect(fieldsFrom(null)).toEqual([])
    expect(fieldsFrom({ type: 'object' })).toEqual([])
  })
})

describe('initialValues', () => {
  it('pre-fills defaults and leaves the rest empty', () => {
    expect(initialValues(fieldsFrom(SCHEMA))).toEqual({ order: '', speed: 0.5, mode: '', label: '', armed: false, pose: '' })
  })
})

describe('validateValues', () => {
  it('names a missing required field and an out-of-range number, nothing else', () => {
    const fields = fieldsFrom(SCHEMA)
    expect(validateValues(fields, { order: '', speed: 2, mode: 'slow', label: '', armed: false, pose: '' })).toEqual([
      { name: 'order', message: 'Required.' },
      { name: 'speed', message: 'At most 1.' }
    ])
  })

  it('checks a pattern and a json field only when they carry something', () => {
    const fields = fieldsFrom(SCHEMA)
    expect(validateValues(fields, { order: 3, speed: 0, mode: 'fast', label: 'Ab', armed: true, pose: '{' })).toEqual([
      { name: 'label', message: 'Must match ^[a-z]+$.' },
      { name: 'pose', message: 'Not valid JSON.' }
    ])
  })
})

describe('toParams', () => {
  it('sends numbers as numbers, parses json, and omits empty optionals', () => {
    const fields = fieldsFrom(SCHEMA)
    expect(toParams(fields, { order: '7', speed: '', mode: 'slow', label: '', armed: true, pose: '{"x":1}' })).toEqual({
      order: 7, mode: 'slow', armed: true, pose: { x: 1 }
    })
  })
})
