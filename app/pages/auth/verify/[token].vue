<script setup lang="ts">
import { sentenceFor } from '~/utils/errors'

definePageMeta({ layout: 'auth' })
const client = useFleetless()
const { state, problem, run } = useTokenPage(token => client.auth.verifyEmail(token), '/auth/verify/done')

const email = ref('')
const resent = ref(false)
const resendProblem = ref<string | null>(null)

async function resend() {
  resendProblem.value = null
  try {
    await client.auth.resendVerification(email.value)
    resent.value = true
  } catch (error) {
    resendProblem.value = sentenceFor(error)
  }
}

onMounted(async () => {
  await run()
  if (state.value === 'done') await navigateTo('/robots')
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Verifying your address
    </h1>
    <p v-if="state === 'spending'" class="text-sm text-muted">
      One moment.
    </p>
    <template v-else-if="state === 'spent'">
      <p class="text-sm">
        This link has been used already, or it expired. Links live 24 hours.
      </p>
      <p v-if="resent" class="text-sm">
        Check your mail. If that address needs a verification link, one is on its way.
      </p>
      <form v-else class="flex flex-col gap-2" @submit.prevent="resend">
        <UInput
          v-model="email"
          type="email"
          placeholder="your@address"
          class="w-full"
        />
        <UAlert
          v-if="resendProblem"
          color="error"
          variant="subtle"
          :title="resendProblem"
        />
        <UButton type="submit" label="Send me a new link" variant="outline" />
      </form>
    </template>
    <UAlert
      v-else-if="state === 'failed'"
      color="error"
      variant="subtle"
      :title="problem ?? 'The link did not work.'"
    />
  </div>
</template>
