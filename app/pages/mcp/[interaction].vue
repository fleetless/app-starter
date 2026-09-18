<script setup lang="ts">
import type { ClientMcpInteraction } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'

definePageMeta({ layout: 'auth' })
const client = useFleetless()
const route = useRoute()
const { identity, resolve } = useSession()
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

onMounted(async () => {
  // The provider buttons here come back to this page, not to /auth/callback:
  // the consent decision is what the person came for, and the shared callback
  // would drop the interaction on the floor.
  const returned = await useOidcReturn(`/mcp/${id.value}`)
  problem.value = returned.problem
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
