<script setup lang="ts">
import type { ClientMcpInteraction } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'
import { takeOidc } from '~/utils/oidc'

definePageMeta({ layout: 'auth' })
const client = useFleetless()
const route = useRoute()
const { identity, resolve, onSignedIn } = useSession()
const { starter } = useAppConfig()

const interaction = ref<ClientMcpInteraction | null>(null)
const problem = ref<string | null>(null)
const deciding = ref(false)
const id = computed(() => (typeof route.params.interaction === 'string' ? route.params.interaction : ''))

// Read WITH the session: `already_granted` is answered from the bearer, and an
// anonymous read answers `false` with a 200 on it.
async function load() {
  problem.value = null
  try {
    interaction.value = await client.auth.mcpInteraction(id.value)
  } catch (error) {
    problem.value = sentenceFor(error)
  }
}

/**
 * The provider buttons on this page come back here, not to /auth/callback:
 * the consent decision is what the person came for, and the shared callback
 * would drop the interaction on the floor. So this page spends the code
 * itself, the same exchange that page runs.
 */
async function finishOidcReturn() {
  const params = new URL(window.location.href).searchParams
  if (!params.has('code') && !params.has('error')) return
  const failure = client.auth.oidcErrorFromCallback(params)
  const remembered = takeOidc()
  // The code was single-use; the URL that carried it is not worth keeping.
  window.history.replaceState({}, '', `/mcp/${id.value}`)
  if (failure) {
    problem.value = sentenceFor(failure)
    return
  }
  try {
    await client.auth.completeOidcLogin({
      code: params.get('code') ?? '',
      state: params.get('state') ?? '',
      expectedState: remembered?.state ?? '',
      codeVerifier: remembered?.verifier ?? ''
    })
    await onSignedIn()
  } catch (error) {
    problem.value = sentenceFor(error)
  }
}

onMounted(async () => {
  await finishOidcReturn()
  if (await resolve()) await load()
})

async function decide(approve: boolean) {
  deciding.value = true
  try {
    const decision = approve
      ? await client.auth.approveMcpInteraction(id.value)
      : await client.auth.denyMcpInteraction(id.value)
    // Both answers redirect: a denial carries error=access_denied, so the
    // client learns the outcome where it is waiting.
    window.location.assign(decision.redirectTo)
  } catch (error) {
    problem.value = sentenceFor(error)
    deciding.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="!identity">
      <h1 class="text-lg font-semibold">
        Sign in to continue
      </h1>
      <p class="text-sm text-muted">
        An AI tool wants to connect to {{ starter.name }} as you.
      </p>
      <AuthLoginForm :redirect-path="`/mcp/${id}`" @signed-in="load" />
    </template>

    <template v-else-if="interaction">
      <h1 class="text-lg font-semibold">
        Allow this connection?
      </h1>
      <p class="text-sm">
        A client calling itself <strong>{{ interaction.client_name ?? 'nothing at all' }}</strong> wants to act
        as <strong>{{ identity.email }}</strong> in {{ starter.name }}. That name is the client's own claim; nobody checked it.
      </p>
      <p class="text-sm text-muted">
        It will be able to do whatever your role allows here, until you disconnect it under Account.
        This request expires {{ new Date(interaction.expires_at).toLocaleTimeString() }}.
      </p>
      <p v-if="interaction.already_granted" class="text-sm text-muted">
        You allowed this client before.
      </p>
      <div class="flex gap-2">
        <UButton label="Allow" :loading="deciding" @click="decide(true)" />
        <UButton
          label="Deny"
          color="neutral"
          variant="outline"
          :disabled="deciding"
          @click="decide(false)"
        />
      </div>
    </template>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
  </div>
</template>
