<script setup lang="ts">
import type { SignInMethods } from '@fleetless/sdk'
import { sentenceFor, twoFactorConflict } from '~/utils/errors'
import { readProblem, requireSignInMethods } from '~/utils/sign-in-methods'

type View = 'off' | 'enrolling' | 'codes' | 'on' | 'turning_off'

const client = useFleetless()
const { identity, onSignedIn, expire } = useSession()
const { starter } = useAppConfig()

const view = ref<View>(identity.value?.two_factor_enabled ? 'on' : 'off')
const policy = ref<SignInMethods['twoFactor'] | null>(null)
const policyProblem = ref<string | null>(null)
const codes = ref<string[]>([])
const code = ref('')
const busy = ref(false)
const problem = ref<string | null>(null)

const hasFactor = computed(() => identity.value?.two_factor_enabled === true)
const showSection = computed(() => policy.value !== null && (policy.value !== 'off' || hasFactor.value))
const canSetUp = computed(() => !hasFactor.value && (policy.value === 'optional' || policy.value === 'required'))
const canTurnOff = computed(() => hasFactor.value && policy.value !== null && policy.value !== 'required')

let policyRead = 0

/** Only the latest read lands: a slower one still in flight is dropped, never written over a newer answer. */
async function retryPolicy() {
  const read = ++policyRead
  policy.value = null
  policyProblem.value = null
  try {
    const twoFactor = requireSignInMethods(await client.auth.signInMethods()).twoFactor
    if (read === policyRead) policy.value = twoFactor
  } catch (error) {
    if (read === policyRead) policyProblem.value = readProblem(error, 'Could not read this app\'s two-factor policy. Try again.')
  }
}

onMounted(retryPolicy)

async function fromIdentity() {
  await onSignedIn()
  view.value = hasFactor.value ? 'on' : 'off'
  await retryPolicy()
}

async function enrolFailed(error: unknown) {
  if (twoFactorConflict(error)) {
    await fromIdentity()
    return
  }
  if (await expire(error, '/account/security')) return
  problem.value = sentenceFor(error)
  await fromIdentity()
}

function startSetup() {
  if (!canSetUp.value) return
  view.value = 'enrolling'
}

function startTurnOff() {
  if (!canTurnOff.value) return
  view.value = 'turning_off'
}

function enrolled(recoveryCodes: string[]) {
  codes.value = recoveryCodes
  view.value = 'codes'
}

async function turnOff() {
  if (!canTurnOff.value || busy.value) return
  busy.value = true
  problem.value = null
  try {
    await client.auth.disableTwoFactor(code.value)
    await fromIdentity()
  } catch (error) {
    if (twoFactorConflict(error)) await fromIdentity()
    else if (!(await expire(error, '/account/security'))) problem.value = sentenceFor(error)
  } finally {
    busy.value = false
    code.value = ''
  }
}
</script>

<template>
  <UDashboardPanel id="security">
    <template #header>
      <UDashboardNavbar title="Security">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 w-full lg:max-w-2xl mx-auto">
        <div v-if="policyProblem" class="flex flex-col gap-3">
          <UAlert color="error" variant="subtle" :title="policyProblem" />
          <UButton label="Retry" class="w-fit" @click="retryPolicy" />
        </div>
        <UPageCard
          v-if="showSection"
          title="Two-factor authentication"
          description="A code from an authenticator app at every sign-in, after your password or emailed code."
          variant="subtle"
        >
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3 text-sm">
              <UBadge :color="hasFactor ? 'success' : 'neutral'" variant="subtle" :label="hasFactor ? 'On' : 'Off'" />
              <span v-if="policy === 'required'" class="text-muted">Required by {{ starter.name }}</span>
            </div>

            <UButton
              v-if="view === 'off' && canSetUp"
              label="Set up"
              class="w-fit"
              @click="startSetup"
            />
            <AuthTotpEnroll v-else-if="view === 'enrolling' && canSetUp" @confirmed="enrolled" @failed="enrolFailed" />
            <AuthRecoveryCodes v-else-if="view === 'codes'" :codes="codes" @done="fromIdentity" />
            <UButton
              v-else-if="view === 'on' && canTurnOff"
              label="Turn off"
              color="error"
              variant="outline"
              class="w-fit"
              @click="startTurnOff"
            />
            <form v-else-if="view === 'turning_off' && canTurnOff" class="flex flex-col gap-4 max-w-xs" @submit.prevent="turnOff">
              <UFormField label="Current code">
                <AuthCodeInput v-model="code" :disabled="busy" />
              </UFormField>
              <div class="flex gap-2">
                <UButton
                  type="submit"
                  label="Turn off"
                  color="error"
                  :loading="busy"
                  :disabled="code.length !== 6"
                />
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="outline"
                  @click="view = 'on'"
                />
              </div>
            </form>

            <UAlert
              v-if="problem"
              color="error"
              variant="subtle"
              :title="problem"
            />
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
