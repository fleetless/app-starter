<script setup lang="ts">
import { forgetChallenge, readChallenge, type PendingChallenge } from '~/utils/sign-in-challenge'
import { sentenceFor } from '~/utils/errors'
import { safeNext } from '~/utils/routes'

definePageMeta({ layout: 'auth' })
const { onSignedIn } = useSession()
const { restart } = useSignInResult()
const { starter } = useAppConfig()

const pending = ref<PendingChallenge | null>(null)
const codes = ref<string[] | null>(null)
const next = ref('/robots')
const problem = ref<string | null>(null)

onMounted(async () => {
  const stored = readChallenge()
  if (!stored) return navigateTo('/auth/login')
  if (stored.status !== 'two_factor_setup_required') return navigateTo('/auth/two-factor')
  pending.value = stored
  next.value = safeNext(stored.next)
})

function confirmed(recoveryCodes: string[]) {
  // The challenge is spent and the session stored; a reload now must not
  // try either again. The codes live only in this component, shown once.
  forgetChallenge()
  codes.value = recoveryCodes
}

async function failed(error: unknown) {
  // Every refusal on this path ends the sign-in step: a dead or unknown
  // challenge cannot be set up from. Back to the start, saying why.
  problem.value = sentenceFor(error)
  await restart(pending.value?.next)
}

async function done() {
  await onSignedIn()
  await navigateTo(next.value)
}
</script>

<template>
  <div v-if="pending" class="flex flex-col gap-4">
    <p class="text-xs text-muted">
      <span :class="codes ? '' : 'text-highlighted font-medium'">1 Scan</span> ›
      <span :class="codes ? 'text-highlighted font-medium' : ''">2 Save codes</span>
    </p>
    <template v-if="!codes">
      <h1 class="text-lg font-semibold">
        Set up two-factor authentication
      </h1>
      <p class="text-sm text-muted">
        {{ starter.name }} requires it for every account. Scan the code with an authenticator app — Google Authenticator, 1Password, Authy, any TOTP app.
      </p>
      <AuthTotpEnroll :challenge="pending.challenge" @confirmed="confirmed" @failed="failed" />
    </template>
    <template v-else>
      <h1 class="text-lg font-semibold">
        Save your recovery codes
      </h1>
      <p class="text-sm text-muted">
        If you lose your phone, each code signs you in once. We show them only now.
      </p>
      <AuthRecoveryCodes :codes="codes" @done="done" />
    </template>
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
  </div>
</template>
