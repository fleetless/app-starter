<script setup lang="ts">
import type { SignInResult } from '@fleetless/sdk'
import { isDeadCode, sentenceFor } from '~/utils/errors'
import { formatCountdown } from '~/utils/countdown'

const RESEND_AFTER_S = 60

const props = defineProps<{ email: string, passwordOn: boolean }>()
const emit = defineEmits<{ result: [result: SignInResult], back: [] }>()

const client = useFleetless()
const code = ref('')
const busy = ref(false)
const problem = ref<string | null>(null)
const wait = ref(RESEND_AFTER_S)
let timer: ReturnType<typeof setInterval> | null = null

function startCountdown(seconds: number) {
  wait.value = seconds
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    wait.value = Math.max(0, wait.value - 1)
    if (wait.value === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}
onMounted(() => startCountdown(RESEND_AFTER_S))
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

async function verify() {
  busy.value = true
  problem.value = null
  try {
    emit('result', await client.auth.verifyLoginCode(props.email, code.value))
  } catch (error) {
    if (isDeadCode(error)) {
      problem.value = 'That code expired. Request a new one.'
      startCountdown(0)
    } else {
      problem.value = sentenceFor(error)
    }
    code.value = ''
  } finally {
    busy.value = false
  }
}

async function resend() {
  problem.value = null
  try {
    await client.auth.requestLoginCode(props.email)
    startCountdown(RESEND_AFTER_S)
  } catch (error) {
    problem.value = sentenceFor(error)
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="font-medium">
      Check your email
    </p>
    <p class="text-sm text-muted">
      We sent a 6-digit code to <strong>{{ email }}</strong>. It works for 10 minutes.
    </p>
    <form class="flex flex-col gap-4" @submit.prevent="verify">
      <AuthCodeInput v-model="code" :disabled="busy" />
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        :title="problem"
      />
      <UButton
        type="submit"
        label="Continue"
        block
        :loading="busy"
        :disabled="code.length !== 6"
      />
    </form>
    <div class="flex items-center gap-3 text-sm">
      <span v-if="wait > 0" class="text-muted">Resend code in <span class="font-mono">{{ formatCountdown(wait) }}</span></span>
      <UButton
        v-else
        label="Resend"
        variant="link"
        class="p-0"
        @click="resend"
      />
      <span class="grow" />
      <UButton
        :label="passwordOn ? 'Use password instead' : 'Use another email'"
        variant="link"
        color="neutral"
        class="p-0"
        @click="emit('back')"
      />
    </div>
  </div>
</template>
