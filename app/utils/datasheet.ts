import type { McpExposure, McpRobotDatasheet } from '@fleetless/sdk'

export type TabKey = 'datapoints' | 'actions' | 'services' | 'publishers' | 'cameras' | 'activity' | 'assets' | 'model' | 'logbook'
export interface TabSpec {
  key: TabKey
  label: string
  count: number | null
}

/** The collection `collections.yaml` defines for the Logbook tab. */
export const LOGBOOK_COLLECTION = 'logbook'

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

/** Whether the sheet grants the datapoint `slug`. */
export function grantsDatapoint(sheet: McpRobotDatasheet, slug: string): boolean {
  return exposuresOf(sheet, 'datapoint').some(e => e.slug === slug)
}

/**
 * The tabs a sheet earns: one per kind it grants, plus one per capability, plus
 * the Logbook. A sheet granting nothing earns none, except the Logbook for a
 * role that may read the logbook collection (`logbook`, which comes from the
 * schema's own `definitions` and not from the sheet). The Logbook is not a
 * grant of the sheet but a collection: it is offered wherever the robot shows
 * anything, and wherever the role can read it; the collection's own `access`
 * decides what it holds.
 */
export function tabsFor(sheet: McpRobotDatasheet, logbook = false): TabSpec[] {
  const tabs: TabSpec[] = []
  for (const tab of KIND_TABS) {
    const count = exposuresOf(sheet, tab.kind).length
    if (count > 0) tabs.push({ key: tab.key, label: tab.label, count })
  }
  if (sheet.capabilities.action_history) tabs.push({ key: 'activity', label: 'Activity', count: null })
  if (sheet.capabilities.assets) tabs.push({ key: 'assets', label: 'Assets', count: null })
  if (sheet.capabilities.assets) tabs.push({ key: 'model', label: '3D', count: null })
  if (tabs.length > 0 || logbook) tabs.push({ key: 'logbook', label: 'Logbook', count: null })
  return tabs
}
