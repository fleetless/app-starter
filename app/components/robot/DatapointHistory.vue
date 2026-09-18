<script setup lang="ts">
import type { McpExposure } from '@fleetless/sdk'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

const props = defineProps<{ robotId: string, exposure: McpExposure }>()
const open = defineModel<boolean>('open', { default: false })
const client = useFleetless()
const { onError } = useRobotSheet()
const colorMode = useColorMode()

const CHART_HEIGHT = 240

const RANGES = [
  { label: 'Last hour', from: 'now-1h' },
  { label: 'Last 6 hours', from: 'now-6h' },
  { label: 'Last 24 hours', from: 'now-24h' }
]
const from = ref(RANGES[0]!.from)

/**
 * What the modal has to say, as one value: two states can then never claim the
 * same window, and "the page absorbed the refusal" is not "the window was quiet".
 */
type Outcome
  = | { kind: 'loading' }
    | { kind: 'chart', truncated: boolean }
    | { kind: 'empty' }
    | { kind: 'unchartable' }
    | { kind: 'problem', sentence: string }
    // `refused`: the page took the refusal and is re-reading the sheet, so this
    // card is on its way out and the modal says nothing at all.
    | { kind: 'refused' }

const outcome = ref<Outcome>({ kind: 'loading' })
const container = ref<HTMLDivElement | null>(null)
const probePrimary = ref<HTMLElement | null>(null)
const probeText = ref<HTMLElement | null>(null)
const probeGrid = ref<HTMLElement | null>(null)

let plot: uPlot | null = null
let data: [number[], number[]] = [[], []]
// Only the newest range may draw: a slower earlier read resolving last would
// leave a chart under a select that names a different window.
let requests = 0
let observer: ResizeObserver | null = null
let lastWidth = 0

async function load() {
  const seq = ++requests
  outcome.value = { kind: 'loading' }
  destroy()
  try {
    const page = await client.datapoints.history(props.robotId, props.exposure.slug, { from: from.value, limit: 2000 })
    if (seq !== requests) return
    const xs: number[] = []
    const ys: number[] = []
    for (const sample of page.samples) {
      // Only a number goes on an axis; a string or an object datapoint has a
      // history, just not a chartable one.
      if (typeof sample.value !== 'number') continue
      xs.push(sample.timestamp_ms)
      ys.push(sample.value)
    }
    data = [xs, ys]
    if (xs.length === 0) {
      outcome.value = page.samples.length > 0 ? { kind: 'unchartable' } : { kind: 'empty' }
      return
    }
    outcome.value = { kind: 'chart', truncated: page.truncated }
    // The container renders for a chart and nothing else, so it exists one tick on.
    await nextTick()
    if (seq === requests) draw()
  } catch (error) {
    if (seq !== requests) return
    data = [[], []]
    const sentence = await onError(error)
    if (seq !== requests) return
    outcome.value = sentence === null ? { kind: 'refused' } : { kind: 'problem', sentence }
  }
}

/**
 * uPlot hands `stroke` straight to the canvas, which knows nothing about CSS
 * variables, and its own default axis stroke is black — unreadable on a dark
 * surface. So read colours off three probe spans, where `color` has already
 * computed to something a canvas accepts, and follow the theme for free.
 */
function palette() {
  const read = (el: HTMLElement | null, fallback: string) => (el && getComputedStyle(el).color) || fallback
  return {
    primary: read(probePrimary.value, '#00c16a'),
    text: read(probeText.value, '#71717a'),
    grid: read(probeGrid.value, '#a1a1aa')
  }
}

function draw() {
  const el = container.value
  if (!el) return
  destroy()
  const colours = palette()
  const axis = { stroke: colours.text, grid: { stroke: colours.grid }, ticks: { stroke: colours.grid } }
  lastWidth = el.clientWidth
  plot = new uPlot({
    width: lastWidth,
    height: CHART_HEIGHT,
    // Milliseconds on the x axis: `time: true` AND `ms: 1` together.
    ms: 1,
    scales: { x: { time: true } },
    legend: { show: false },
    axes: [{ ...axis }, { ...axis, label: props.exposure.unit ?? undefined }],
    series: [{}, { stroke: colours.primary, width: 2 }]
  }, data, el)

  // uPlot sizes its canvas once. Without this, a rotated phone keeps the width
  // the modal had when it opened.
  observer = new ResizeObserver(() => {
    const width = el.clientWidth
    if (!plot || width === 0 || width === lastWidth) return
    lastWidth = width
    plot.setSize({ width, height: CHART_HEIGHT })
  })
  observer.observe(el)
}

function destroy() {
  observer?.disconnect()
  observer = null
  plot?.destroy()
  plot = null
}

watch(open, async (isOpen) => {
  if (isOpen) {
    // The modal body mounts with the overlay, so the probes and the container
    // exist only after this tick.
    await nextTick()
    await load()
  } else {
    // Nobody may read this chart again; the next open reads its own window.
    requests++
    destroy()
  }
})
watch(from, load)

// The tokens flip with the theme, and the canvas has already been painted.
watch(() => colorMode.value, async () => {
  if (outcome.value.kind !== 'chart') return
  await nextTick()
  draw()
})

onBeforeUnmount(destroy)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="exposure.slug"
    :description="exposure.description ?? undefined"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <!-- Probes, not CSS variables: `color` computes to a real colour, and a
             canvas cannot resolve `var(--ui-primary)` for itself. -->
        <span ref="probePrimary" class="hidden text-primary" />
        <span ref="probeText" class="hidden text-muted" />
        <span ref="probeGrid" class="hidden text-dimmed" />

        <USelect
          v-model="from"
          :items="RANGES.map(r => ({ label: r.label, value: r.from }))"
          class="w-48"
        />
        <UAlert
          v-if="outcome.kind === 'problem'"
          color="error"
          variant="subtle"
          :title="outcome.sentence"
        />
        <p v-else-if="outcome.kind === 'loading'" class="text-sm text-dimmed">
          Reading the recorded window.
        </p>
        <p v-else-if="outcome.kind === 'unchartable'" class="text-sm text-muted">
          Recorded, but not as numbers. There is no chart for this one.
        </p>
        <p v-else-if="outcome.kind === 'empty'" class="text-sm text-muted">
          Nothing recorded in this window. Try a longer one.
        </p>
        <template v-else-if="outcome.kind === 'chart'">
          <p v-if="outcome.truncated" class="text-xs text-dimmed">
            Cut short by the platform's read cap. The window holds more than this.
          </p>
          <div ref="container" class="w-full" />
        </template>
      </div>
    </template>
  </UModal>
</template>
