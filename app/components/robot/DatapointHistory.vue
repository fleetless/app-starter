<script setup lang="ts">
import type { McpExposure } from '@fleetless/sdk'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

const props = defineProps<{ robotId: string, exposure: McpExposure }>()
const open = defineModel<boolean>('open', { default: false })
const client = useFleetless()
const { onError } = useRobotSheet()

const RANGES = [
  { label: 'Last hour', from: 'now-1h' },
  { label: 'Last 6 hours', from: 'now-6h' },
  { label: 'Last 24 hours', from: 'now-24h' }
]
const from = ref(RANGES[0]!.from)
const problem = ref<string | null>(null)
const points = ref(0)
// Samples received against points plotted: a non-numeric datapoint records
// fine and charts not at all, which is not the same as a quiet window.
const received = ref(0)
// The platform caps a read by rows or by bytes; a short series that does not
// admit it looks exactly like a quiet period.
const truncated = ref(false)
const container = ref<HTMLDivElement | null>(null)
let plot: uPlot | null = null

async function load() {
  problem.value = null
  try {
    const page = await client.datapoints.history(props.robotId, props.exposure.slug, { from: from.value, limit: 2000 })
    const xs: number[] = []
    const ys: number[] = []
    for (const sample of page.samples) {
      // Only a number goes on an axis; a string or an object datapoint has a
      // history, just not a chartable one.
      if (typeof sample.value !== 'number') continue
      xs.push(sample.timestamp_ms)
      ys.push(sample.value)
    }
    received.value = page.samples.length
    points.value = xs.length
    truncated.value = page.truncated
    draw([xs, ys])
  } catch (error) {
    // Destroy first: an error over the previous range's chart reads as if that
    // chart were the answer.
    plot?.destroy()
    plot = null
    points.value = 0
    received.value = 0
    problem.value = await onError(error)
  }
}

function draw(data: [number[], number[]]) {
  if (!container.value) return
  plot?.destroy()
  plot = new uPlot({
    width: container.value.clientWidth,
    height: 240,
    // Milliseconds on the x axis: `time: true` AND `ms: 1` together.
    ms: 1,
    scales: { x: { time: true } },
    legend: { show: false },
    axes: [{}, { label: props.exposure.unit ?? undefined }],
    series: [{}, { stroke: 'var(--ui-primary)', width: 2 }]
  }, data, container.value)
}

watch(open, async (isOpen) => {
  if (isOpen) {
    // The modal body mounts with the overlay, so the container exists only after this tick.
    await nextTick()
    await load()
  } else {
    plot?.destroy()
    plot = null
  }
})
watch(from, load)
onBeforeUnmount(() => {
  plot?.destroy()
  plot = null
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="exposure.slug"
    :description="exposure.description ?? undefined"
  >
    <template #body>
      <!-- The card behind this opens the modal on click; a click inside must not re-open it. -->
      <div class="flex flex-col gap-3" @click.stop>
        <USelect
          v-model="from"
          :items="RANGES.map(r => ({ label: r.label, value: r.from }))"
          class="w-48"
        />
        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          :title="problem"
        />
        <p v-else-if="received > 0 && points === 0" class="text-sm text-muted">
          Recorded, but not as numbers. There is no chart for this one.
        </p>
        <p v-else-if="points === 0" class="text-sm text-muted">
          Nothing recorded in this window. Try a longer one.
        </p>
        <p v-else-if="truncated" class="text-xs text-dimmed">
          Cut short by the platform's read cap. The window holds more than this.
        </p>
        <div ref="container" class="w-full" />
      </div>
    </template>
  </UModal>
</template>
