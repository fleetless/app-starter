/**
 * A form from the datasheet's `input_schema`: the JSON Schema the cloud builds
 * from an action's, service's or publisher's `parameters`. Only what those
 * parameters can express is mapped — string, number, integer, boolean, enum,
 * min/max, pattern, default, required — and anything else becomes a JSON
 * textarea rather than a refusal, so no exposure is uncallable from here.
 */
export type FieldKind = 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'json'

export interface FieldSpec {
  name: string
  kind: FieldKind
  required: boolean
  default?: unknown
  options?: (string | number)[]
  min?: number
  max?: number
  pattern?: string
  description?: string
}

type Property = Record<string, unknown>

function kindOf(property: Property): FieldKind {
  if (Array.isArray(property.enum)) return 'enum'
  switch (property.type) {
    case 'string': return 'string'
    case 'number': return 'number'
    case 'integer': return 'integer'
    case 'boolean': return 'boolean'
    default: return 'json'
  }
}

export function fieldsFrom(schema: unknown): FieldSpec[] {
  if (!schema || typeof schema !== 'object') return []
  const root = schema as { properties?: Record<string, Property>, required?: string[] }
  if (!root.properties) return []
  const required = new Set(root.required ?? [])
  return Object.entries(root.properties).map(([name, property]) => {
    const kind = kindOf(property)
    const field: FieldSpec = { name, kind, required: required.has(name) }
    if (property.default !== undefined) field.default = property.default
    if (kind === 'enum') field.options = property.enum as (string | number)[]
    if (typeof property.minimum === 'number') field.min = property.minimum
    if (typeof property.maximum === 'number') field.max = property.maximum
    if (typeof property.pattern === 'string') field.pattern = property.pattern
    if (typeof property.description === 'string') field.description = property.description
    return field
  })
}

export function initialValues(fields: FieldSpec[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.default !== undefined) values[field.name] = field.kind === 'json' ? JSON.stringify(field.default) : field.default
    else values[field.name] = field.kind === 'boolean' ? false : ''
  }
  return values
}

const isEmpty = (value: unknown) => value === '' || value === undefined || value === null

export function validateValues(fields: FieldSpec[], values: Record<string, unknown>): { name: string, message: string }[] {
  const errors: { name: string, message: string }[] = []
  for (const field of fields) {
    const value = values[field.name]
    // An untouched optional is not a violation; a missing required one is, and
    // a boolean is never missing — `false` is an answer.
    if (isEmpty(value)) {
      if (field.required && field.kind !== 'boolean') errors.push({ name: field.name, message: 'Required.' })
      continue
    }
    if (field.kind === 'number' || field.kind === 'integer') {
      const n = Number(value)
      if (!Number.isFinite(n)) errors.push({ name: field.name, message: 'A number.' })
      else if (field.kind === 'integer' && !Number.isInteger(n)) errors.push({ name: field.name, message: 'A whole number.' })
      else if (field.min !== undefined && n < field.min) errors.push({ name: field.name, message: `At least ${field.min}.` })
      else if (field.max !== undefined && n > field.max) errors.push({ name: field.name, message: `At most ${field.max}.` })
    } else if (field.kind === 'string' && field.pattern && !new RegExp(field.pattern).test(String(value))) {
      errors.push({ name: field.name, message: `Must match ${field.pattern}.` })
    } else if (field.kind === 'json') {
      try {
        JSON.parse(String(value))
      } catch {
        errors.push({ name: field.name, message: 'Not valid JSON.' })
      }
    }
  }
  return errors
}

export function toParams(fields: FieldSpec[], values: Record<string, unknown>): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  for (const field of fields) {
    const value = values[field.name]
    // A boolean always travels: an unticked switch means `false`, not "unset".
    if (field.kind === 'boolean') {
      params[field.name] = Boolean(value)
      continue
    }
    if (isEmpty(value)) continue
    if (field.kind === 'number' || field.kind === 'integer') params[field.name] = Number(value)
    else if (field.kind === 'json') params[field.name] = JSON.parse(String(value))
    else params[field.name] = value
  }
  return params
}
