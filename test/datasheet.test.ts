import { describe, expect, it } from 'vitest'
import type { McpRobotDatasheet } from '@fleetless/sdk'
import { exposuresOf, tabsFor } from '~/utils/datasheet'

const exposure = (slug: string, kind: McpRobotDatasheet['exposures'][number]['kind']) =>
  ({ slug, kind, description: null, unit: null, decimals: null, input_schema: null })

const sheet = (exposures: McpRobotDatasheet['exposures'], capabilities = { action_history: false, assets: false }): McpRobotDatasheet =>
  ({ robot_id: 'r', robot_name: 'rx1', capabilities, exposures })

describe('tabsFor', () => {
  it('has one tab per kind present, in a fixed order, with its count', () => {
    const tabs = tabsFor(sheet([exposure('a', 'action'), exposure('b', 'datapoint'), exposure('c', 'datapoint')]))
    expect(tabs).toEqual([
      { key: 'datapoints', label: 'Datapoints', count: 2 },
      { key: 'actions', label: 'Actions', count: 1 }
    ])
  })

  it('adds Activity and Assets for the two capabilities, without a count', () => {
    const tabs = tabsFor(sheet([], { action_history: true, assets: true }))
    expect(tabs).toEqual([
      { key: 'activity', label: 'Activity', count: null },
      { key: 'assets', label: 'Assets', count: null }
    ])
  })

  it('answers no tabs for a sheet that grants nothing', () => {
    expect(tabsFor(sheet([]))).toEqual([])
  })
})

describe('exposuresOf', () => {
  it('filters by kind and keeps the sheet order', () => {
    const s = sheet([exposure('x', 'service'), exposure('y', 'publisher'), exposure('z', 'service')])
    expect(exposuresOf(s, 'service').map(e => e.slug)).toEqual(['x', 'z'])
  })
})
