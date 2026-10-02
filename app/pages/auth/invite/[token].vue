<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const client = useFleetless()
const password = ref('')
const displayName = ref('')
const passwordOn = ref(true)
const ready = ref(false)
onMounted(async () => {
  try {
    passwordOn.value = (await client.auth.signInMethods()).password
  } catch {
    // Unreadable: today's form. A code-only app refuses a password with
    // validation_error, and that sentence shows on the form.
    passwordOn.value = true
  }
  ready.value = true
})
const { state, problem, run } = useTokenPage(
  token => client.auth.acceptInvitation({
    token,
    password: passwordOn.value ? password.value : undefined,
    displayName: displayName.value || undefined
  }),
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
    <form v-if="ready && (!started || state === 'failed')" class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField v-if="passwordOn" label="Password" hint="12+ characters">
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
