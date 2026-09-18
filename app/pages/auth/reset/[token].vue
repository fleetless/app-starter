<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const client = useFleetless()
const route = useRoute()
const password = ref('')
const { state, problem, run } = useTokenPage(token => client.auth.confirmPasswordReset(token, password.value), '/auth/reset/done')
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
      Choose a new password
    </h1>
    <form v-if="!started || state === 'failed'" class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField label="New password" hint="12+ characters">
        <UInput
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="w-full"
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
        label="Set password"
        block
        :disabled="!route.params.token"
      />
    </form>
    <p v-else-if="state === 'spent'" class="text-sm">
      This link has been used already, or it expired. Reset links live one hour.
      <ULink to="/auth/forgot">
        Request another
      </ULink>.
    </p>
    <p v-else class="text-sm text-muted">
      One moment.
    </p>
  </div>
</template>
