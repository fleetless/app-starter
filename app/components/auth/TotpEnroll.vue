<script setup lang="ts">
import QRCode from 'qrcode'
import { FleetlessError } from '@fleetless/sdk'
import { isDeadCode, sentenceFor } from '~/utils/errors'

/**
 * Scan, or type the key; then one code from the app confirms it. Two ways
 * in, as the SDK has them: with the sign-in's `challenge`, or without one
 * from account settings, where the current session is the credential.
 * Whatever the page has to decide (a dead challenge, the app's policy) goes
 * up as `failed`; a wrong code stays here.
 */
const props = defineProps<{ challenge?: string }>()
const emit = defineEmits<{ confirmed: [codes: string[]], failed: [error: unknown] }>()

const client = useFleetless()
const toast = useToast()
const secret = ref<string | null>(null)
const qr = ref<string | null>(null)
const code = ref('')
const busy = ref(false)
const problem = ref<string | null>(null)

onMounted(async () => {
  try {
    const setup = await client.auth.beginTwoFactorSetup(props.challenge ? { challenge: props.challenge } : {})
    secret.value = setup.secret
    // An SVG string, not toDataURL: the browser build's PNG path needs a
    // canvas, which happy-dom (the tests) does not have. As an <img> source
    // it needs no v-html.
    const svg = await QRCode.toString(setup.otpauthUrl, { type: 'svg', margin: 1 })
    qr.value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  } catch (error) {
    emit('failed', error)
  }
})

async function copyKey() {
  if (!secret.value) return
  await navigator.clipboard.writeText(secret.value)
  toast.add({ title: 'Copied.' })
}

async function confirm() {
  busy.value = true
  problem.value = null
  try {
    const { recoveryCodes } = await client.auth.confirmTwoFactorSetup(
      props.challenge ? { code: code.value, challenge: props.challenge } : { code: code.value }
    )
    emit('confirmed', recoveryCodes)
  } catch (error) {
    // Account settings answers attempts_left 0 on every wrong code (no counter
    // there), so only the sign-in path can be dead (plan ruling 6).
    const dead = props.challenge ? isDeadCode(error) : error instanceof FleetlessError && error.code === 'token_spent'
    if (dead) emit('failed', error)
    else problem.value = sentenceFor(error)
  } finally {
    busy.value = false
    code.value = ''
  }
}
</script>

<template>
  <div v-if="secret" class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <img
        v-if="qr"
        :src="qr"
        alt="QR code for your authenticator app"
        class="size-32 rounded bg-white p-1"
      >
      <div class="flex flex-col gap-1 text-sm min-w-0">
        <span class="text-muted">Can't scan it? Enter this key:</span>
        <span class="font-mono break-all">{{ secret }}</span>
        <UButton
          label="Copy key"
          size="xs"
          color="neutral"
          variant="outline"
          class="w-fit"
          @click="copyKey"
        />
      </div>
    </div>
    <form class="flex flex-col gap-4" @submit.prevent="confirm">
      <UFormField label="Code from the app">
        <AuthCodeInput v-model="code" :disabled="busy" />
      </UFormField>
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
  </div>
  <p v-else class="text-sm text-muted">
    One moment.
  </p>
</template>
