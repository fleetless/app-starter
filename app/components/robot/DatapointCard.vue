<script setup lang="ts">
import type { McpExposure } from '@fleetless/sdk'
import { useNow } from '@vueuse/core'
import { formatAge, formatValue } from '~/utils/format'

const props = defineProps<{ robotId: string, exposure: McpExposure }>()
const { value, timestampMs, problem } = useDatapoint(props.robotId, props.exposure.slug)
// A second hand, so a value that stopped arriving visibly ages instead of lying still.
const now = useNow({ interval: 1000 })
const age = computed(() => timestampMs.value === null ? null : formatAge(now.value.getTime() - timestampMs.value))
const historyOpen = ref(false)
</script>

<template>
  <!-- A div with a role, not `as="button"`: UCard wraps the slot in its own
       divs, which a real <button> may not contain. -->
  <UCard
    role="button"
    tabindex="0"
    aria-haspopup="dialog"
    class="cursor-pointer hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    @click="historyOpen = true"
    @keydown.enter.prevent="historyOpen = true"
    @keydown.space.prevent="historyOpen = true"
  >
    <div class="flex flex-col gap-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-mono text-sm text-muted truncate">{{ exposure.slug }}</span>
        <span v-if="age" class="text-xs text-dimmed shrink-0">{{ age }}</span>
      </div>
      <p v-if="problem" class="text-sm text-error">
        {{ problem }}
      </p>
      <p v-else-if="value === undefined" class="text-sm text-dimmed">
        waiting for a value
      </p>
      <p v-else class="text-2xl font-semibold tabular-nums truncate">
        {{ formatValue(value, exposure.decimals) }}<span v-if="exposure.unit" class="text-base text-muted ml-1">{{ exposure.unit }}</span>
      </p>
      <p v-if="exposure.description" class="text-xs text-muted">
        {{ exposure.description }}
      </p>
    </div>
    <RobotDatapointHistory
      v-model:open="historyOpen"
      :robot-id="robotId"
      :exposure="exposure"
    />
  </UCard>
</template>
