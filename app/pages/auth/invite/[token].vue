<script setup lang="ts">
import type { SignInMethods } from '@fleetless/sdk'
import { requireSignInMethods } from '~/utils/sign-in-methods'

definePageMeta({ layout: 'auth' })
const client = useFleetless()
const { starter } = useAppConfig()
const password = ref('')
const displayName = ref('')
const methods = ref<SignInMethods | null>(null)
const policyProblem = ref<string | null>(null)
const loading = ref(false)
async function loadMethods() {
  if (loading.value) return
  loading.value = true
  methods.value = null
  policyProblem.value = null
  try {
    methods.value = requireSignInMethods(await client.auth.signInMethods())
  } catch {
    policyProblem.value = 'Could not read this app\'s sign-in methods and two-factor policy. Try again.'
  } finally {
    loading.value = false
  }
}
onMounted(loadMethods)
const { state, problem, run } = useTokenPage(
  token => client.auth.acceptInvitation({
    token,
    password: methods.value?.password ? password.value : undefined,
    displayName: displayName.value || undefined
  }),
  '/auth/invite/done'
)
const started = ref(false)
const accepting = ref(false)

async function submit() {
  if (!methods.value || accepting.value) return
  accepting.value = true
  started.value = true
  try {
    await run()
    if (state.value === 'done') await navigateTo('/robots')
  } finally {
    accepting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      You have been invited
    </h1>
    <div v-if="policyProblem" class="flex flex-col gap-3">
      <UAlert color="error" variant="subtle" :title="policyProblem" />
      <UButton label="Retry" class="w-fit" @click="loadMethods" />
    </div>
    <form v-else-if="methods && (!started || state === 'failed')" class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField v-if="methods.password" label="Password" hint="12+ characters">
        <UInput
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <p v-else class="text-sm text-muted">
        You sign in with a code we email you — no password.
      </p>
      <p v-if="methods.twoFactor === 'required'" class="text-sm text-muted">
        Next you set up two-factor authentication — {{ starter.name }} requires it.
      </p>
      <UFormField label="Display name" hint="optional">
        <UInput v-model="displayName" class="w-full" />
      </UFormField>
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        :title="problem"
      />
      <UButton type="submit" label="Accept and sign in" block />
    </form>
    <p v-else-if="state === 'spent'" class="text-sm">
      This invitation has been used already, or it expired. Invitations live seven days; ask for a new one.
    </p>
    <p v-else class="text-sm text-muted">
      One moment.
    </p>
  </div>
</template>
