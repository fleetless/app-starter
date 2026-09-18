<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ProviderButton } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'
import { rememberOidc } from '~/utils/oidc'

const props = defineProps<{
  /** Where the OIDC round trip returns to. Defaults to this app's callback page. */
  redirectPath?: string
}>()
const emit = defineEmits<{ signedIn: [] }>()

const client = useFleetless()
const { onSignedIn } = useSession()

const schema = z.object({
  email: z.string().email('An email address, please.'),
  password: z.string().min(1, 'A password, please.')
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '', password: '' })
const busy = ref(false)
const problem = ref<string | null>(null)
const providers = ref<ProviderButton[]>([])

onMounted(async () => {
  try {
    providers.value = await client.auth.listProviders()
  } catch {
    // No provider list is no buttons. The password form still works.
    providers.value = []
  }
})

async function submit(event: FormSubmitEvent<Schema>) {
  busy.value = true
  problem.value = null
  try {
    await client.auth.login(event.data.email, event.data.password)
    await onSignedIn()
    emit('signedIn')
  } catch (error) {
    problem.value = sentenceFor(error)
  } finally {
    busy.value = false
  }
}

async function signInWith(slug: string) {
  problem.value = null
  const request = await client.auth.beginOidcLogin({
    slug,
    redirectUri: `${window.location.origin}${props.redirectPath ?? '/auth/callback'}`
  })
  rememberOidc(request.state, request.codeVerifier)
  window.location.assign(request.url)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UForm
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
      <UFormField label="Password" name="password">
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
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
        label="Sign in"
        block
        :loading="busy"
      />
    </UForm>

    <template v-if="providers.length">
      <USeparator label="or" />
      <UButton
        v-for="provider in providers"
        :key="provider.slug"
        color="neutral"
        variant="outline"
        block
        :label="`Continue with ${provider.name}`"
        @click="signInWith(provider.slug)"
      />
    </template>

    <div class="flex justify-between text-sm">
      <ULink to="/auth/forgot">
        Forgot password
      </ULink>
      <ULink to="/auth/register">
        Create an account
      </ULink>
    </div>
  </div>
</template>
