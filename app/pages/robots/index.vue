<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ClientRobotListItem } from '@fleetless/sdk'

const { robots, loading, problem, reload } = useRobots()
const NuxtLink = resolveComponent('NuxtLink')
const UBadge = resolveComponent('UBadge')

const columns: TableColumn<ClientRobotListItem>[] = [
  {
    accessorKey: 'name',
    header: 'Robot',
    cell: ({ row }) => h(NuxtLink, { to: `/robots/${row.original.id}`, class: 'font-medium text-highlighted hover:underline' }, () => row.original.name)
  },
  {
    accessorKey: 'bridge_state',
    header: 'Bridge',
    cell: ({ row }) => {
      const state = row.original.bridge_state
      return h(UBadge, { color: state.online ? 'success' : 'neutral', variant: 'subtle' }, () =>
        state.online ? `online${state.latency_ms === null ? '' : ` · ${Math.round(state.latency_ms)} ms`}` : 'offline')
    }
  },
  {
    accessorKey: 'published_version',
    header: 'Configuration',
    cell: ({ row }) => row.original.published_version === null ? 'nothing published' : `v${row.original.published_version}`
  }
]

onMounted(reload)
</script>

<template>
  <UDashboardPanel id="robots">
    <template #header>
      <UDashboardNavbar title="Robots">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="loading"
            @click="reload"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        :title="problem"
      />
      <div v-else-if="!loading && robots.length === 0" class="text-sm text-muted max-w-prose">
        <p class="font-medium text-default">
          No robots yet.
        </p>
        <p>
          Your role grants nothing on any robot of this app. In the Fleetless Console, attach a robot to the app and tick
          something for your role on the Roles tab; this list follows at the next reload.
        </p>
      </div>
      <UTable
        v-else
        :data="robots"
        :columns="columns"
        :loading="loading"
        data-test="robots"
      />
    </template>
  </UDashboardPanel>
</template>
