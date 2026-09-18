import type { FleetlessClient } from '@fleetless/sdk'

/** The one client for the life of the page, created in plugins/fleetless.client.ts. */
export function useFleetless(): FleetlessClient {
  return useNuxtApp().$fleetless as FleetlessClient
}
