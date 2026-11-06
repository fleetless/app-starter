import { describe, expect, it } from 'vitest'
import type { McpRobotDatasheet } from '@fleetless/sdk'
import { exposuresOf, grantsDatapoint, tabsFor } from '~/utils/datasheet'

const exposure = (slug: string, kind: McpRobotDatasheet['exposures'][number]['kind']) =>
  ({ slug, kind, description: null, unit: null, decimals: null, input_schema: null })

const sheet = (exposures: McpRobotDatasheet['exposures'], capabilities = { job_history: false, assets: false }): McpRobotDatasheet =>
  ({ robot_id: 'r', robot_name: 'rx1', capabilities, exposures })

describe('tabsFor', () => {
  it('has one tab per kind present, in a fixed order, with its count', () => {
    const tabs = tabsFor(sheet([exposure('a', 'action'), exposure('b', 'datapoint'), exposure('c', 'datapoint')]))
    expect(tabs).toEqual([
      { key: 'datapoints', label: 'Datapoints', count: 2 },
      { key: 'actions', label: 'Actions', count: 1 },
      { key: 'logbook', label: 'Logbook', count: null }
    ])
  })

  it('adds Activity, Assets and 3D for the capabilities, and the Logbook last, without a count', () => {
    const tabs = tabsFor(sheet([], { job_history: true, assets: true }))
    expect(tabs).toEqual([
      { key: 'activity', label: 'Activity', count: null },
      { key: 'assets', label: 'Assets', count: null },
      { key: 'model', label: '3D', count: null },
      { key: 'logbook', label: 'Logbook', count: null }
    ])
  })

  it('offers no 3D tab without the assets capability', () => {
    const tabs = tabsFor(sheet([], { job_history: true, assets: false }))
    expect(tabs.map(t => t.key)).toEqual(['activity', 'logbook'])
  })

  it('offers no Activity tab without the job_history capability', () => {
    const tabs = tabsFor(sheet([], { job_history: false, assets: true }))
    expect(tabs.map(t => t.key)).toEqual(['assets', 'model', 'logbook'])
  })

  it('answers no tabs for a sheet that grants nothing, the Logbook included', () => {
    expect(tabsFor(sheet([]))).toEqual([])
    expect(tabsFor(sheet([]), false)).toEqual([])
  })

  it('offers the Logbook on its own where the role may read it and the sheet grants nothing', () => {
    expect(tabsFor(sheet([]), true)).toEqual([{ key: 'logbook', label: 'Logbook', count: null }])
  })

  it('puts the Logbook last once, whatever else the sheet earns', () => {
    const tabs = tabsFor(sheet([exposure('a', 'datapoint')]), true)
    expect(tabs.map(t => t.key)).toEqual(['datapoints', 'logbook'])
  })
})

describe('grantsDatapoint', () => {
  it('is true for a granted datapoint', () => {
    expect(grantsDatapoint(sheet([exposure('joint_states', 'datapoint')]), 'joint_states')).toBe(true)
  })

  it('is false when the slug is exposed as another kind', () => {
    expect(grantsDatapoint(sheet([exposure('joint_states', 'service')]), 'joint_states')).toBe(false)
  })

  it('is false when the slug is absent', () => {
    expect(grantsDatapoint(sheet([exposure('other', 'datapoint')]), 'joint_states')).toBe(false)
  })
})

describe('exposuresOf', () => {
  it('filters by kind and keeps the sheet order', () => {
    const s = sheet([exposure('x', 'service'), exposure('y', 'publisher'), exposure('z', 'service')])
    expect(exposuresOf(s, 'service').map(e => e.slug)).toEqual(['x', 'z'])
  })
})
