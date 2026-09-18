<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { JobRun } from '@fleetless/sdk'

const props = defineProps<{ robotId: string }>()
const client = useFleetless()
const { onError } = useRobotSheet()
const UBadge = resolveComponent('UBadge')

const runs = ref<JobRun[]>([])
const cursor = ref<number | null>(null)
const loading = ref(false)
const problem = ref<string | null>(null)
const exhausted = ref(false)

// Page until next_cursor is null, never until a page looks short: the cloud
// filters the page by the role's grants after reading it, so a thin or empty
// page can still carry a cursor.
async function more() {
  loading.value = true
  problem.value = null
  try {
    const page = await client.jobs.history(props.robotId, { limit: 50, beforeSeq: cursor.value ?? undefined })
    runs.value.push(...page.runs)
    cursor.value = page.next_cursor
    exhausted.value = page.next_cursor === null
  } catch (error) {
    problem.value = await onError(error)
  } finally {
    loading.value = false
  }
}

const STATE_COLOR: Record<string, string> = { running: 'primary', succeeded: 'success', failed: 'error', cancelled: 'neutral', lost: 'warning' }
const columns: TableColumn<JobRun>[] = [
  { accessorKey: 'started_at', header: 'Started', cell: ({ row }) => new Date(row.original.started_at).toLocaleString() },
  { accessorKey: 'slug', header: 'Slug', cell: ({ row }) => h('span', { class: 'font-mono' }, row.original.slug) },
  { accessorKey: 'actor', header: 'By', cell: ({ row }) => row.original.actor.label },
  { accessorKey: 'state', header: 'Outcome', cell: ({ row }) => h(UBadge, { color: STATE_COLOR[row.original.state] ?? 'neutral', variant: 'subtle' }, () => row.original.state) },
  { accessorKey: 'duration_ms', header: 'Took', cell: ({ row }) => row.original.duration_ms === null ? '' : `${(row.original.duration_ms / 1000).toFixed(1)} s` }
]

onMounted(more)
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-sm text-muted">
      What has run on this robot, newest first, kept for 90 days. A row names who started it.
    </p>
    <!-- The alert sits beside the table, not instead of it: a refusal on page
         three must not take the two pages already read off the screen. -->
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
    <p v-if="exhausted && runs.length === 0" class="text-sm">
      Nothing has run yet.
    </p>
    <UTable
      v-else
      :data="runs"
      :columns="columns"
      :loading="loading"
    />
    <UButton
      v-if="!exhausted"
      label="Older"
      variant="outline"
      class="w-fit"
      :loading="loading"
      @click="more"
    />
  </div>
</template>
