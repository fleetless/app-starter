<script setup lang="ts">
import { sentenceFor } from '~/utils/errors'

definePageMeta({ layout: 'auth' })
const client = useFleetless()
const email = ref('')
const sent = ref(false)
const problem = ref<string | null>(null)

async function submit() {
  problem.value = null
  try {
    await client.auth.requestPasswordReset(email.value)
    sent.value = true
  } catch (error) {
    problem.value = sentenceFor(error)
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Forgot your password
    </h1>
    <p v-if="sent" class="text-sm">
      If that address has an account, a reset link is on its way.
    </p>
    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField label="Email">
        <UInput
          v-model="email"
          type="email"
          autocomplete="username"
          class="w-full"
        />
      </UFormField>
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        :title="problem"
      />
      <UButton type="submit" label="Send a reset link" block />
    </form>
    <ULink to="/auth/login" class="text-sm">
      Back to sign in
    </ULink>
  </div>
</template>
