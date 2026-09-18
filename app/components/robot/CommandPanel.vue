<script setup lang="ts">
import type { McpExposure } from '@fleetless/sdk'
import { fieldErrorsFrom } from '~/utils/errors'

const props = defineProps<{ robotId: string, exposure: McpExposure }>()
const client = useFleetless()
const { onError } = useRobotSheet()

const busy = ref(false)
const cancelling = ref(false)
const problem = ref<string | null>(null)
const fieldErrors = ref<{ name: string, message: string }[]>([])
const result = ref<unknown>(undefined)
const sent = ref(false)

// Only an action has a job to watch; a service's job is unwrapped by `call`,
// a publisher has none.
const job = props.exposure.kind === 'action' ? useJob(props.robotId, props.exposure.slug) : null

// Partial: a datapoint and a camera never reach this panel, and the fallback
// is what an exposure kind added later reads as until it gets its own verb.
const VERBS: Partial<Record<McpExposure['kind'], string>> = { action: 'Start', service: 'Call', publisher: 'Send' }
const verb = VERBS[props.exposure.kind] ?? 'Run'

async function submit(params: Record<string, unknown>) {
  busy.value = true
  problem.value = null
  // A new array every time: the form compares this prop by reference.
  fieldErrors.value = []
  result.value = undefined
  sent.value = false
  try {
    if (props.exposure.kind === 'action') {
      await client.actions.invoke(props.robotId, props.exposure.slug, params)
    } else if (props.exposure.kind === 'service') {
      result.value = await client.services.call(props.robotId, props.exposure.slug, params)
    } else {
      await client.publishers.publish(props.robotId, props.exposure.slug, params)
      sent.value = true
    }
  } catch (error) {
    fieldErrors.value = fieldErrorsFrom(error)
    if (fieldErrors.value.length === 0) problem.value = await onError(error)
  } finally {
    busy.value = false
  }
}

// Busy while it waits: every click here is a real ROS goal cancel, and the
// sentence from a failed submit has nothing to say about this one.
async function cancel() {
  cancelling.value = true
  problem.value = null
  try {
    await client.actions.cancel(props.robotId, props.exposure.slug, job?.event.value?.job.id ?? null)
  } catch (error) {
    problem.value = await onError(error)
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-mono text-sm">{{ exposure.slug }}</span>
        <UBadge color="neutral" variant="subtle">
          {{ exposure.kind }}
        </UBadge>
      </div>
      <p v-if="exposure.description" class="text-xs text-muted mt-1">
        {{ exposure.description }}
      </p>
    </template>

    <RobotParameterForm
      :schema="exposure.input_schema"
      :submit-label="verb"
      :busy="busy"
      :field-errors="fieldErrors"
      @submit="submit"
    />

    <div v-if="job" class="mt-4 flex flex-col gap-2 text-sm">
      <div v-if="job.event.value" class="flex items-center gap-2">
        <UBadge :color="job.running.value ? 'primary' : job.event.value.job.state === 'succeeded' ? 'success' : 'neutral'" variant="subtle">
          {{ job.event.value.job.state }}
        </UBadge>
        <!-- `null` is UProgress's own indeterminate: an action that reports no progress still says it is running. -->
        <UProgress
          v-if="job.running.value"
          :model-value="job.event.value.progress === null ? null : job.event.value.progress * 100"
          class="flex-1"
        />
        <UButton
          v-if="job.running.value"
          label="Cancel"
          size="xs"
          color="error"
          variant="outline"
          :loading="cancelling"
          @click="cancel"
        />
      </div>
      <pre v-if="job.event.value?.feedback" class="text-xs bg-elevated rounded p-2 overflow-auto">{{ JSON.stringify(job.event.value.feedback, null, 2) }}</pre>
      <pre v-if="job.event.value?.job.result" class="text-xs bg-elevated rounded p-2 overflow-auto">{{ JSON.stringify(job.event.value.job.result, null, 2) }}</pre>
      <p v-if="job.event.value?.job.error" class="text-error">
        {{ job.event.value.job.error.message }}
      </p>
      <p v-if="job.problem.value" class="text-error">
        {{ job.problem.value }}
      </p>
    </div>

    <pre v-if="result !== undefined" class="mt-4 text-xs bg-elevated rounded p-2 overflow-auto">{{ JSON.stringify(result, null, 2) }}</pre>
    <p v-if="sent" class="mt-4 text-sm text-muted">
      Sent. One message, no stream: the robot's own failsafe takes over when this app goes quiet.
    </p>
    <UAlert
      v-if="problem"
      class="mt-4"
      color="error"
      variant="subtle"
      :title="problem"
    />
  </UCard>
</template>
