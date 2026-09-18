<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { sentenceFor } from '~/utils/errors'

definePageMeta({ layout: 'auth' })
const client = useFleetless()

const schema = z.object({
  email: z.string().email('An email address, please.'),
  password: z.string().min(12, 'Twelve characters or more.'),
  displayName: z.string().max(200).optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '', password: '', displayName: '' })
const busy = ref(false)
const problem = ref<string | null>(null)
const sent = ref(false)

async function submit(event: FormSubmitEvent<Schema>) {
  busy.value = true
  problem.value = null
  try {
    await client.auth.register({ email: event.data.email, password: event.data.password, displayName: event.data.displayName || undefined })
    // A 202 is a statement about a mail, not about an account.
    sent.value = true
  } catch (error) {
    problem.value = sentenceFor(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Create an account
    </h1>
    <template v-if="sent">
      <p class="text-sm">
        Check your mail. If that address needs a verification link, one is on its way.
      </p>
      <ULink to="/auth/login" class="text-sm">
        Back to sign in
      </ULink>
    </template>
    <UForm
      v-else
      :schema="schema"
      :state="state"
      class="flex flex-col gap-4"
      @submit="submit"
    >
      <UFormField label="Email" name="email">
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="username"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Password" name="password" hint="12+ characters">
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Display name" name="displayName" hint="optional">
        <UInput v-model="state.displayName" class="w-full" />
      </UFormField>
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        :title="problem"
      />
      <UButton
        type="submit"
        label="Create account"
        block
        :loading="busy"
      />
      <ULink to="/auth/login" class="text-sm">
        Already have one? Sign in
      </ULink>
    </UForm>
  </div>
</template>
