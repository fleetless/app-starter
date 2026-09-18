import type { McpExposure, McpRobotDatasheet } from '@fleetless/sdk'

export type TabKey = 'datapoints' | 'actions' | 'services' | 'publishers' | 'cameras' | 'activity' | 'assets'
export interface TabSpec {
  key: TabKey
  label: string
  count: number | null
}

const KIND_TABS: { key: TabKey, label: string, kind: McpExposure['kind'] }[] = [
  { key: 'datapoints', label: 'Datapoints', kind: 'datapoint' },
  { key: 'actions', label: 'Actions', kind: 'action' },
  { key: 'services', label: 'Services', kind: 'service' },
  { key: 'publishers', label: 'Publishers', kind: 'publisher' },
  { key: 'cameras', label: 'Cameras', kind: 'camera' }
]

export function exposuresOf(sheet: McpRobotDatasheet, kind: McpExposure['kind']): McpExposure[] {
  return sheet.exposures.filter(e => e.kind === kind)
}

/** The tabs a sheet earns: one per kind it grants, plus one per capability. A sheet granting nothing earns none. */
export function tabsFor(sheet: McpRobotDatasheet): TabSpec[] {
  const tabs: TabSpec[] = []
  for (const tab of KIND_TABS) {
    const count = exposuresOf(sheet, tab.kind).length
    if (count > 0) tabs.push({ key: tab.key, label: tab.label, count })
  }
  if (sheet.capabilities.action_history) tabs.push({ key: 'activity', label: 'Activity', count: null })
  if (sheet.capabilities.assets) tabs.push({ key: 'assets', label: 'Assets', count: null })
  return tabs
}
