import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { CollectionDefinition, CollectionEvent, CollectionRecord, CollectionSubscribeOptions } from '@fleetless/sdk'
import Logbook from '~/components/robot/Logbook.vue'
import { RobotSheet, type RobotSheetContext } from '~/composables/useDatasheet'
import { refusal } from './fake-auth'

const ROBOT = '00000000-0000-4000-8000-000000000001'
const USER = '00000000-0000-4000-8000-000000000003'

// The cloud's collections routes are not needed here: the SDK namespace is
// replaced, so this file says what the tab does with each answer, not what
// the cloud answers.
const fake = vi.hoisted(() => ({
  definitions: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  options: null as CollectionSubscribeOptions | null,
  emit: null as ((event: CollectionEvent) => void) | null
}))
mockNuxtImport('useFleetless', () => () => ({ collections: fake }))

const at = (minute: number) => `2026-11-05T10:${String(minute).padStart(2, '0')}:00.000Z`

function entry(id: string, text: string, minute: number, extra: Partial<CollectionRecord> = {}): CollectionRecord {
  const who = { kind: 'app_user' as const, id: USER, label: 'ann@example.com' }
  return {
    id,
    robot_id: ROBOT,
    created_at: at(minute),
    created_by: who,
    updated_at: at(minute),
    updated_by: who,
    revision: 1,
    display: at(minute),
    values: { text, category: 'note' },
    ...extra
  }
}

const definition = (create = true): CollectionDefinition => ({
  key: 'logbook',
  label: 'Logbook',
  description: '',
  binding: 'per_robot',
  display: '{{created_at}}',
  fields: {
    text: { type: 'long_text', required: true, searchable: true },
    category: { type: 'select', options: [{ value: 'note' }, { value: 'fault' }, { value: 'maintenance', label: 'Maintenance' }] }
  },
  can: { read: true, create, update: false, delete: false }
})

const sheetContext = (): RobotSheetContext => ({
  sheet: ref(null),
  reload: async () => {},
  onError: vi.fn(async () => null)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function mountLogbook(context?: RobotSheetContext) {
  const wrapper = await mountSuspended(Logbook, {
    props: { robotId: ROBOT },
    global: context ? { provide: { [RobotSheet as symbol]: context } } : {}
  })
  await flushPromises()
  return wrapper
}

const send = async (event: CollectionEvent) => {
  fake.emit?.(event)
  await flushPromises()
}

const positions = (shown: string, ...texts: string[]) => texts.map(t => shown.indexOf(t))

beforeEach(() => {
  for (const fn of [fake.definitions, fake.list, fake.create, fake.subscribe, fake.unsubscribe]) fn.mockReset()
  fake.options = null
  fake.emit = null
  fake.definitions.mockResolvedValue([definition()])
  fake.list.mockResolvedValue({ records: [], nextCursor: null })
  fake.subscribe.mockImplementation((_collection: string, options: CollectionSubscribeOptions, onEvent: (event: CollectionEvent) => void) => {
    fake.options = options
    fake.emit = onEvent
    return fake.unsubscribe
  })
})

describe('RobotLogbook', () => {
  it('loads the list newest first after subscribing', async () => {
    fake.list.mockResolvedValue({ records: [entry('b', 'Belt retensioned', 5, { values: { text: 'Belt retensioned', category: 'maintenance' } }), entry('a', 'Charged', 1)], nextCursor: null })

    const page = await mountLogbook()

    // Subscribe first, list second: a change between the two would be lost the other way round.
    expect(fake.subscribe).toHaveBeenCalledWith('logbook', expect.objectContaining({ robot: ROBOT }), expect.any(Function))
    expect(fake.list).toHaveBeenCalledWith('logbook', { robot: ROBOT, sort: ['-created_at'], limit: 50 })
    expect(fake.subscribe.mock.invocationCallOrder[0]).toBeLessThan(fake.list.mock.invocationCallOrder[0]!)

    const [belt, charged] = positions(page.text(), 'Belt retensioned', 'Charged')
    expect(belt).toBeGreaterThan(-1)
    expect(charged).toBeGreaterThan(belt!)
    // The author, and the category by its label where the schema gives one.
    expect(page.text()).toContain('ann@example.com')
    expect(page.text()).toContain('Maintenance')
  })

  it('a created event prepends once even if the list already holds it', async () => {
    fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1)], nextCursor: null })
    const page = await mountLogbook()

    // The list read its row before the event for it arrived: nothing doubles.
    await send({ event: 'created', id: 'a', record: entry('a', 'Charged', 1) })
    expect(page.text().split('Charged')).toHaveLength(2)

    await send({ event: 'created', id: 'c', record: entry('c', 'Door sensor dirty', 9) })
    const [door, charged] = positions(page.text(), 'Door sensor dirty', 'Charged')
    expect(door).toBeGreaterThan(-1)
    expect(charged).toBeGreaterThan(door!)
  })

  it('keeps what arrives while the list is on its way', async () => {
    const list = deferred<{ records: CollectionRecord[], nextCursor: string | null }>()
    fake.list.mockReturnValue(list.promise)
    const page = await mountLogbook()

    // Both events happened after the list was read, so the list cannot hold them;
    // the older one it holds in its stale form.
    await send({ event: 'created', id: 'c', record: entry('c', 'Door sensor dirty', 9) })
    await send({ event: 'updated', id: 'a', record: entry('a', 'Charged to 80 %', 1, { revision: 2 }) })
    list.resolve({ records: [entry('a', 'Charged', 1)], nextCursor: null })
    await flushPromises()

    const [door, charged] = positions(page.text(), 'Door sensor dirty', 'Charged to 80 %')
    expect(door).toBeGreaterThan(-1)
    expect(charged).toBeGreaterThan(door!)
    expect(page.text()).not.toMatch(/Charged(?! to)/)
  })

  it('updated replaces, deleted and removed drop, entered inserts in time order', async () => {
    fake.list.mockResolvedValue({ records: [entry('c', 'Third', 30), entry('a', 'First', 10)], nextCursor: null })
    const page = await mountLogbook()

    await send({ event: 'updated', id: 'a', record: entry('a', 'First, corrected', 10, { revision: 2 }) })
    expect(page.text()).toContain('First, corrected')

    // An older revision than the one on screen does not win.
    await send({ event: 'updated', id: 'a', record: entry('a', 'First, stale', 10, { revision: 1 }) })
    expect(page.text()).not.toContain('First, stale')

    await send({ event: 'entered', id: 'b', record: entry('b', 'Second', 20) })
    const [third, second, first] = positions(page.text(), 'Third', 'Second', 'First, corrected')
    expect(third).toBeGreaterThan(-1)
    expect(second).toBeGreaterThan(third!)
    expect(first).toBeGreaterThan(second!)

    await send({ event: 'deleted', id: 'c', record: entry('c', 'Third', 30) })
    expect(page.text()).not.toContain('Third')

    // `removed` may carry no record at all: the id is enough.
    await send({ event: 'removed', id: 'b' })
    expect(page.text()).not.toContain('Second')
    expect(page.text()).toContain('First, corrected')
  })

  it('unmounting unsubscribes', async () => {
    const page = await mountLogbook()
    expect(fake.unsubscribe).not.toHaveBeenCalled()

    page.unmount()
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('an absent collection shows the empty state and no form', async () => {
    fake.definitions.mockResolvedValue([])
    const page = await mountLogbook()

    expect(page.text()).toContain('No logbook yet. Publish collections.yaml to add one.')
    expect(page.find('textarea').exists()).toBe(false)
    expect(page.text()).not.toContain('Add entry')
    expect(fake.list).not.toHaveBeenCalled()
  })

  it('a refused subscription to a missing collection adds no sentence to the empty state', async () => {
    fake.definitions.mockResolvedValue([])
    const context = sheetContext()
    const page = await mountLogbook(context)

    fake.options?.onError?.(refusal('collection_not_found', undefined, 404))
    await flushPromises()

    expect(page.text()).toContain('No logbook yet. Publish collections.yaml to add one.')
    expect(page.text()).not.toContain('refused')
    expect(context.onError).not.toHaveBeenCalled()
  })

  it('canCreate false hides the form', async () => {
    fake.definitions.mockResolvedValue([definition(false)])
    fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1)], nextCursor: null })
    const page = await mountLogbook()

    expect(page.text()).toContain('Charged')
    expect(page.find('textarea').exists()).toBe(false)
    expect(page.text()).not.toContain('Add entry')
  })

  it('says so when nothing has been written yet', async () => {
    const page = await mountLogbook()

    expect(page.text()).toContain('Nothing written yet.')
    expect(page.text()).toContain('Add entry')
  })

  it('reads the schema and the list again when a developer publishes', async () => {
    fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1)], nextCursor: null })
    const page = await mountLogbook()
    expect(page.find('textarea').exists()).toBe(true)

    // The role lost `create` in the new version.
    fake.definitions.mockResolvedValue([definition(false)])
    fake.options?.onSchemaPublished?.(2)
    await flushPromises()

    expect(fake.definitions).toHaveBeenCalledTimes(2)
    expect(fake.list).toHaveBeenCalledTimes(2)
    expect(page.find('textarea').exists()).toBe(false)
    expect(page.text()).toContain('Charged')
  })

  describe('when a read does not go through', () => {
    const find = (page: Awaited<ReturnType<typeof mountLogbook>>, label: string) =>
      page.findAll('button').find(b => b.text() === label)

    it('a failed list read does not claim nothing was written, and Try again reads it again', async () => {
      fake.list.mockRejectedValueOnce(refusal('internal_error', undefined, 500))
      const page = await mountLogbook()

      // The schema was read, the list was not: the tab says so and does not call the logbook empty.
      expect(page.text()).toContain('The request was refused (internal_error).')
      expect(page.text()).not.toContain('Nothing written yet.')
      expect(find(page, 'Try again')).toBeDefined()

      fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1)], nextCursor: null })
      await find(page, 'Try again')!.trigger('click')
      await flushPromises()

      expect(fake.list).toHaveBeenCalledTimes(2)
      expect(page.text()).toContain('Charged')
      expect(page.text()).not.toContain('internal_error')
      expect(find(page, 'Try again')).toBeUndefined()
      // The subscription never ended, so it is not opened a second time.
      expect(fake.subscribe).toHaveBeenCalledTimes(1)
    })

    it('an empty list that was read still says nothing has been written', async () => {
      fake.list.mockRejectedValueOnce(refusal('internal_error', undefined, 500))
      const page = await mountLogbook()
      expect(page.text()).not.toContain('Nothing written yet.')

      fake.list.mockResolvedValue({ records: [], nextCursor: null })
      await find(page, 'Try again')!.trigger('click')
      await flushPromises()

      expect(page.text()).toContain('Nothing written yet.')
    })

    it('a failed schema read offers to try again as well', async () => {
      fake.definitions.mockRejectedValueOnce(refusal('internal_error', undefined, 500))
      const page = await mountLogbook()

      expect(page.text()).toContain('The request was refused (internal_error).')
      expect(page.text()).not.toContain('Nothing written yet.')
      expect(fake.list).not.toHaveBeenCalled()

      await find(page, 'Try again')!.trigger('click')
      await flushPromises()

      expect(page.find('textarea').exists()).toBe(true)
      expect(page.text()).toContain('Nothing written yet.')
    })

    it('after a publish the empty state can be left: Check again reads and subscribes again', async () => {
      fake.definitions.mockResolvedValue([])
      const page = await mountLogbook()
      // Before the first publish the cloud refuses the subscription, and the SDK lets it go.
      fake.options?.onError?.(refusal('collection_not_found', undefined, 404))
      await flushPromises()
      expect(page.text()).toContain('No logbook yet.')
      expect(fake.subscribe).toHaveBeenCalledTimes(1)

      // The developer publishes collections.yaml and comes back to the tab.
      fake.definitions.mockResolvedValue([definition()])
      fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1)], nextCursor: null })
      await find(page, 'Check again')!.trigger('click')
      await flushPromises()

      expect(page.text()).not.toContain('No logbook yet.')
      expect(page.text()).toContain('Charged')
      expect(page.find('textarea').exists()).toBe(true)
      expect(fake.definitions).toHaveBeenCalledTimes(2)
      // Subscribed first, so nothing between the two reads is lost, and the new subscription is the live one.
      expect(fake.subscribe).toHaveBeenCalledTimes(2)
      expect(fake.subscribe.mock.invocationCallOrder[1]).toBeLessThan(fake.list.mock.invocationCallOrder[0]!)
      await send({ event: 'created', id: 'b', record: entry('b', 'Door sensor dirty', 9) })
      expect(page.text()).toContain('Door sensor dirty')
    })

    it('Check again on an app that still has no logbook stays on the empty state', async () => {
      fake.definitions.mockResolvedValue([])
      const page = await mountLogbook()

      await find(page, 'Check again')!.trigger('click')
      await flushPromises()

      expect(page.text()).toContain('No logbook yet. Publish collections.yaml to add one.')
      expect(find(page, 'Check again')).toBeDefined()
    })

    it('a collection removed by a publish leaves the empty state, and Check again finds it back', async () => {
      fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1)], nextCursor: null })
      const page = await mountLogbook()
      expect(page.text()).toContain('Charged')

      fake.options?.onError?.(refusal('collection_removed', undefined, 404))
      await flushPromises()
      expect(page.text()).toContain('No logbook yet.')
      expect(page.text()).not.toContain('Charged')

      await find(page, 'Check again')!.trigger('click')
      await flushPromises()

      expect(page.text()).toContain('Charged')
      expect(fake.subscribe).toHaveBeenCalledTimes(2)
    })

    it('after forbidden the tab reads what the role may do now, without subscribing again', async () => {
      fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1)], nextCursor: null })
      const context = sheetContext()
      const page = await mountLogbook(context)
      expect(page.find('textarea').exists()).toBe(true)

      // The role lost `create` and the cloud ended the subscription.
      fake.definitions.mockResolvedValue([definition(false)])
      fake.list.mockResolvedValue({ records: [entry('a', 'Charged', 1), entry('b', 'Door sensor dirty', 9)], nextCursor: null })
      fake.options?.onError?.(refusal('forbidden', undefined, 403))
      await flushPromises()

      expect(context.onError).toHaveBeenCalledTimes(1)
      expect(fake.definitions).toHaveBeenCalledTimes(2)
      expect(page.find('textarea').exists()).toBe(false)
      expect(page.text()).toContain('Door sensor dirty')
      // A role that cannot read would be refused again, and again.
      expect(fake.subscribe).toHaveBeenCalledTimes(1)
    })
  })

  describe('adding an entry', () => {
    async function write(page: Awaited<ReturnType<typeof mountLogbook>>, text: string, category?: string) {
      await page.find('textarea').setValue(text)
      if (category) page.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', category)
      await flushPromises()
      await page.find('form').trigger('submit')
      await flushPromises()
    }

    it('posts text and category with the robot and clears the textarea', async () => {
      const created = entry('n', 'Lidar cleaned', 15, { values: { text: 'Lidar cleaned', category: 'maintenance' } })
      fake.create.mockResolvedValue(created)
      const page = await mountLogbook()

      // The categories are the schema's, not a list in the component.
      expect(page.findComponent({ name: 'USelect' }).props('items')).toEqual([
        { label: 'note', value: 'note' },
        { label: 'fault', value: 'fault' },
        { label: 'Maintenance', value: 'maintenance' }
      ])

      await write(page, 'Lidar cleaned', 'maintenance')

      expect(fake.create).toHaveBeenCalledWith('logbook', { text: 'Lidar cleaned', category: 'maintenance' }, { robot: ROBOT })
      expect((page.find('textarea').element as HTMLTextAreaElement).value).toBe('')
      expect(page.text()).toContain('Lidar cleaned')

      // The cloud then sends the same entry as an event; it stays one row.
      await send({ event: 'created', id: 'n', record: created })
      expect(page.text().split('Lidar cleaned')).toHaveLength(2)
    })

    it('offers no send for a blank entry', async () => {
      const page = await mountLogbook()

      expect(page.find('button[type="submit"]').attributes('disabled')).toBeDefined()
      await page.find('textarea').setValue('   ')
      expect(page.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    })

    it('a plan_limit refusal shows its sentence and keeps the text', async () => {
      fake.create.mockRejectedValue(refusal('plan_limit', { limit: 'collection_records', used: 25000, max: 25000, plan: 'basic', lifted_by: { plan: 'plus', addon: null } }, 409))
      const page = await mountLogbook()

      await write(page, 'Lidar cleaned', 'note')

      expect(page.text()).toContain('This app has no room for more data on its plan.')
      expect((page.find('textarea').element as HTMLTextAreaElement).value).toBe('Lidar cleaned')
    })

    it('a forbidden write says so, although the sheet is re-read for it', async () => {
      fake.create.mockRejectedValue(refusal('forbidden', undefined, 403))
      const context = sheetContext()
      const page = await mountLogbook(context)

      await write(page, 'Lidar cleaned', 'note')

      expect(context.onError).toHaveBeenCalled()
      expect(page.text()).toContain('Your role does not allow that.')
    })

    it('a lapsed session adds no sentence: the login page follows', async () => {
      fake.create.mockRejectedValue(refusal('token_expired', undefined, 401))
      const context = sheetContext()
      const page = await mountLogbook(context)

      await write(page, 'Lidar cleaned', 'note')

      expect(context.onError).toHaveBeenCalled()
      // Not even the fallback, "The request was refused (token_expired)."
      expect(page.text()).not.toContain('refused')
    })

    it('a refusal on the live subscription goes the way of every other tab', async () => {
      const context = sheetContext()
      const page = await mountLogbook(context)

      fake.options?.onError?.(refusal('forbidden', undefined, 403))
      await flushPromises()

      expect(context.onError).toHaveBeenCalledTimes(1)
      expect(page.text()).not.toContain('Your role does not allow that.')
    })
  })
})

/**
 * The slice of YAML `collections.yaml` is written in: block mappings, `- key: value`
 * items, `[a, b]` lists of plain words, plain or "quoted" scalars, whole-line
 * comments. Anything else throws, so a richer file fails here instead of being
 * read in part. The template carries no YAML library for one example file.
 */
function parseYaml(text: string): unknown {
  const lines = text.split('\n').filter(l => l.trim() !== '' && !l.trim().startsWith('#'))
  const indent = (l: string) => l.length - l.trimStart().length
  let cursor = 0

  function scalar(s: string): unknown {
    if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).split(',').map(item => scalar(item.trim()))
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
    if (s === 'true' || s === 'false') return s === 'true'
    if (/^-?\d+$/.test(s)) return Number(s)
    if (/[{}[\]&*!|>'%@`#]/.test(s)) throw new Error(`parseYaml: unsupported scalar ${s}`)
    return s
  }

  function pair(body: string, level: number): [string, unknown] {
    const colon = body.indexOf(':')
    if (colon < 1) throw new Error(`parseYaml: not a key: ${body}`)
    const rest = body.slice(colon + 1).trim()
    const next = lines[cursor]
    return [body.slice(0, colon).trim(), rest !== '' ? scalar(rest) : next !== undefined && indent(next) > level ? block(indent(next)) : null]
  }

  function block(level: number): unknown {
    const items = lines[cursor]!.trim().startsWith('- ')
    const out: Record<string, unknown> | unknown[] = items ? [] : {}
    while (cursor < lines.length && indent(lines[cursor]!) === level && lines[cursor]!.trim().startsWith('- ') === items) {
      const body = lines[cursor++]!.trim()
      const [key, value] = pair(items ? body.slice(2) : body, level)
      if (Array.isArray(out)) out.push({ [key]: value })
      else out[key] = value
    }
    return out
  }

  const parsed = block(0)
  if (cursor !== lines.length) throw new Error(`parseYaml: unread line ${lines[cursor]}`)
  return parsed
}

describe('collections.yaml', () => {
  // Built from import.meta.url's directory by hand: Vite rewrites a literal
  // `new URL('../x', import.meta.url)` to the wrong file under this environment.
  const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'collections.yaml'), 'utf8')

  it('parses and is the logbook of this template: per robot, three roles read, two write', () => {
    expect(parseYaml(text)).toEqual({
      format: 1,
      collections: {
        logbook: {
          label: 'Logbook',
          binding: 'per_robot',
          display: '{{created_at}}',
          access: {
            read: ['observe', 'operate', 'admin'],
            create: ['operate', 'admin'],
            update: { all: 'admin', own: 'operate' },
            delete: 'admin'
          },
          fields: {
            text: { type: 'long_text', required: true, searchable: true },
            category: { type: 'select', options: [{ value: 'note' }, { value: 'fault' }, { value: 'maintenance' }] }
          }
        }
      }
    })
  })
})
