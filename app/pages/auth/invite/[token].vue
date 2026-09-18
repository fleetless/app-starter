<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const client = useFleetless()
const password = ref('')
const displayName = ref('')
const { state, problem, run } = useTokenPage(
  token => client.auth.acceptInvitation({ token, password: password.value, displayName: displayName.value || undefined }),
  '/auth/invite/done'
)
const started = ref(false)

async function submit() {
  started.value = true
  await run()
  if (state.value === 'done') await navigateTo('/robots')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      You have been invited
    </h1>
    <form v-if="!started || state === 'failed'" class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField label="Password" hint="12+ characters">
        <UInput
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
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
