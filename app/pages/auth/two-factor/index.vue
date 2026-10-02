<script setup lang="ts">
import { forgetChallenge, readChallenge, type PendingChallenge } from '~/utils/sign-in-challenge'
import { isDeadCode, sentenceFor } from '~/utils/errors'
import { safeNext } from '~/utils/routes'

definePageMeta({ layout: 'auth' })
const client = useFleetless()
const { onSignedIn } = useSession()
const { restart } = useSignInResult()
const { starter } = useAppConfig()

const pending = ref<PendingChallenge | null>(null)
const recovery = ref(false)
const code = ref('')
const recoveryCode = ref('')
const busy = ref(false)
const problem = ref<string | null>(null)

onMounted(async () => {
  const stored = readChallenge()
  if (!stored) return navigateTo('/auth/login')
  if (stored.status !== 'two_factor_required') return navigateTo('/auth/two-factor/setup')
  pending.value = stored
})

async function verify() {
  if (!pending.value) return
  busy.value = true
  problem.value = null
  try {
    await client.auth.verifyTwoFactor(recovery.value
      ? { challenge: pending.value.challenge, recoveryCode: recoveryCode.value.trim() }
      : { challenge: pending.value.challenge, code: code.value })
    const next = safeNext(pending.value.next)
    forgetChallenge()
    await onSignedIn()
    await navigateTo(next)
  } catch (error) {
    if (isDeadCode(error)) return restart(pending.value.next)
    problem.value = sentenceFor(error)
    code.value = ''
  } finally {
    busy.value = false
  }
}

function switchTo(toRecovery: boolean) {
  recovery.value = toRecovery
  problem.value = null
}

async function someoneElse() {
  forgetChallenge()
  await navigateTo('/auth/login')
}
</script>

<template>
  <div v-if="pending" class="flex flex-col gap-4">
    <template v-if="!recovery">
      <h1 class="text-lg font-semibold">
        Two-factor authentication
      </h1>
      <p class="text-sm text-muted">
        Enter the 6-digit code from your authenticator app for {{ starter.name }}.
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
          label="Verify"
          block
          :loading="busy"
          :disabled="code.length !== 6"
        />
      </form>
      <div class="flex justify-between text-sm">
        <UButton
          label="Use a recovery code"
          variant="link"
          class="p-0"
          @click="switchTo(true)"
        />
        <UButton
          label="Sign in as someone else"
          variant="link"
          color="neutral"
          class="p-0"
          @click="someoneElse"
        />
      </div>
    </template>
    <template v-else>
      <h1 class="text-lg font-semibold">
        Use a recovery code
      </h1>
      <p class="text-sm text-muted">
        One of the ten codes you saved when you set up two-factor. Each works once.
      </p>
      <form class="flex flex-col gap-4" @submit.prevent="verify">
        <UFormField label="Recovery code">
          <UInput
            v-model="recoveryCode"
            name="recovery_code"
            autocomplete="off"
            class="w-full font-mono"
          />
        </UFormField>
        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          :title="problem"
        />
        <UButton
          type="submit"
          label="Verify"
          block
          :loading="busy"
          :disabled="!recoveryCode.trim()"
        />
      </form>
      <UButton
        label="Back to the authenticator code"
        variant="link"
        class="p-0 text-sm"
        @click="switchTo(false)"
      />
    </template>
  </div>
</template>
