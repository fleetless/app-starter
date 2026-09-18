<script setup lang="ts">
import { sentenceFor } from '~/utils/errors'
import { takeOidc } from '~/utils/oidc'

definePageMeta({ layout: 'auth' })

const client = useFleetless()
const { onSignedIn } = useSession()
const problem = ref<string | null>(null)

onMounted(async () => {
  const params = new URL(window.location.href).searchParams
  const failure = client.auth.oidcErrorFromCallback(params)
  if (failure) {
    problem.value = sentenceFor(failure)
    return
  }
  const remembered = takeOidc()
  try {
    await client.auth.completeOidcLogin({
      code: params.get('code') ?? '',
      state: params.get('state') ?? '',
      expectedState: remembered?.state ?? '',
      codeVerifier: remembered?.verifier ?? ''
    })
    // The code was single-use; the URL that carried it is not worth keeping.
    window.history.replaceState({}, '', '/auth/callback')
    await onSignedIn()
    await navigateTo('/robots')
  } catch (error) {
    problem.value = sentenceFor(error)
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Signing in
    </h1>
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
    <p v-else class="text-sm text-muted">
      One moment.
    </p>
    <UButton
      v-if="problem"
      to="/auth/login"
      label="Back to sign in"
      variant="outline"
    />
  </div>
</template>
