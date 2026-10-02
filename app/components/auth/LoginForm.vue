<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ProviderButton, SignInMethods, SignInResult } from '@fleetless/sdk'
import { sentenceFor } from '~/utils/errors'
import { rememberOidc } from '~/utils/oidc'
import { STORAGE_REFUSED } from '~/composables/useSignInResult'

const props = defineProps<{
  /** Where the OIDC round trip returns to. Defaults to this app's callback page. */
  redirectPath?: string
  /** Where to land after any sign-in that completes off this page: a provider round trip, or a second factor. Already guarded by the caller. */
  next?: string
}>()
const emit = defineEmits<{ signedIn: [] }>()

const client = useFleetless()
const { follow } = useSignInResult()
const methods = ref<SignInMethods>({ password: true, emailCode: false })
const codeFor = ref<string | null>(null)

const emailOnly = z.object({ email: z.string().trim().email('An email address, please.') })
const withPassword = emailOnly.extend({ password: z.string().min(1, 'A password, please.') })
const schema = computed(() => (methods.value.password ? withPassword : emailOnly))

const state = reactive<{ email: string, password?: string }>({ email: '', password: '' })
const busy = ref(false)
const problem = ref<string | null>(null)
const providers = ref<ProviderButton[]>([])

onMounted(async () => {
  const [listed, offered] = await Promise.allSettled([client.auth.listProviders(), client.auth.signInMethods()])
  // No provider list is no buttons; no method list is today's password form.
  providers.value = listed.status === 'fulfilled' ? listed.value : []
  if (offered.status === 'fulfilled' && (offered.value.password || offered.value.emailCode)) methods.value = offered.value
})

async function land(result: SignInResult) {
  const outcome = await follow(result, props.next ?? '/robots')
  if (outcome === 'signed_in') emit('signedIn')
  else if (outcome === 'storage_refused') problem.value = STORAGE_REFUSED
}

async function submit(event: FormSubmitEvent<{ email: string, password?: string }>) {
  if (!methods.value.password) return sendCode(event.data.email)
  busy.value = true
  problem.value = null
  try {
    await land(await client.auth.login(event.data.email, event.data.password ?? ''))
  } catch (error) {
    problem.value = sentenceFor(error)
  } finally {
    busy.value = false
  }
}

/** One trim, used for the request and the verify: the code belongs to exactly that address. */
async function sendCode(raw: string | undefined) {
  const parsed = emailOnly.safeParse({ email: raw ?? '' })
  if (!parsed.success) {
    problem.value = 'An email address, please.'
    return
  }
  busy.value = true
  problem.value = null
  try {
    await client.auth.requestLoginCode(parsed.data.email)
    codeFor.value = parsed.data.email
  } catch (error) {
    problem.value = sentenceFor(error)
  } finally {
    busy.value = false
  }
}

async function signInWith(slug: string) {
  problem.value = null
  try {
    const request = await client.auth.beginOidcLogin({
      slug,
      redirectUri: `${window.location.origin}${props.redirectPath ?? '/auth/callback'}`
    })
    // The destination travels in the store, not in the redirect URI, which
    // the provider matches exactly.
    if (!rememberOidc(request.state, request.codeVerifier, props.next)) {
      problem.value = 'This browser refused to keep the sign-in state.'
      return
    }
    window.location.assign(request.url)
  } catch (error) {
    // PKCE needs crypto.subtle, which an insecure origin does not have — a
    // dev server opened at a LAN address over plain HTTP is the usual way in.
    // Without this the button just does nothing.
    problem.value = sentenceFor(error)
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <AuthCodeStep
      v-if="codeFor"
      :email="codeFor"
      :password-on="methods.password"
      @result="land"
      @back="codeFor = null; problem = null"
    />
    <!-- What `land` says after the code step answered: the form below, with its own alert, is not shown. -->
    <UAlert
      v-if="codeFor && problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
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
      <UFormField v-if="methods.password" label="Password" name="password">
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
        :label="methods.password ? 'Sign in' : 'Email me a code'"
        block
        :loading="busy"
      />
      <UButton
        v-if="methods.password && methods.emailCode"
        type="button"
        label="Email me a sign-in code instead"
        variant="ghost"
        block
        @click="sendCode(state.email)"
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
      <ULink v-if="methods.password" to="/auth/forgot">
        Forgot password
      </ULink>
      <ULink to="/auth/register">
        Create an account
      </ULink>
    </div>
  </div>
</template>
