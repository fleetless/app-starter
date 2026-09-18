<script setup lang="ts">
import type { McpConsentGrant } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'

const client = useFleetless()
const { expire } = useSession()
const grants = ref<McpConsentGrant[]>([])
const problem = ref<string | null>(null)
const loaded = ref(false)

async function load() {
  problem.value = null
  try {
    grants.value = await client.auth.listMcpGrants()
  } catch (error) {
    if (!(await expire(error, '/account/connections'))) problem.value = sentenceFor(error)
  } finally {
    loaded.value = true
  }
}

async function disconnect(grant: McpConsentGrant) {
  try {
    await client.auth.revokeMcpGrant(grant.client_id)
    await load()
  } catch (error) {
    if (!(await expire(error, '/account/connections'))) problem.value = sentenceFor(error)
  }
}

onMounted(load)
</script>

<template>
  <UDashboardPanel id="connections">
    <template #header>
      <UDashboardNavbar title="Connected AI tools">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 w-full lg:max-w-2xl mx-auto">
        <p class="text-sm text-muted">
          Every AI tool you allowed to act as you. Disconnecting one stops it at its next call; your other tools and this app are untouched.
        </p>
        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          :title="problem"
        />
        <p v-if="loaded && grants.length === 0" class="text-sm">
          Nothing is connected.
        </p>
        <UCard v-for="grant in grants" :key="grant.client_id">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="font-medium truncate">
                A client calling itself {{ grant.client_name ?? 'nothing' }}
              </p>
              <p class="text-xs text-muted">
                allowed {{ new Date(grant.granted_at).toLocaleString() }} · id <span class="font-mono">{{ grant.client_id }}</span>
              </p>
            </div>
            <UButton
              label="Disconnect"
              color="error"
              variant="outline"
              size="sm"
              @click="disconnect(grant)"
            />
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
