<script setup lang="ts">
import { sentenceFor, twoFactorConflict } from '~/utils/errors'

/**
 * Two-factor on or off for the signed-in person. The app's policy is not
 * readable by a client (plan ruling 3): the page offers what the person's
 * own state allows, and turns the cloud's refusal into the policy statement
 * the moment it arrives — `off` from setting up, `required` from turning
 * off. Nothing is ever done against the policy; the cloud refuses it.
 */
type View = 'off' | 'enrolling' | 'codes' | 'on' | 'turning_off' | 'required' | 'not_offered'

const client = useFleetless()
const { identity, onSignedIn, expire } = useSession()
const { starter } = useAppConfig()

const view = ref<View>(identity.value?.two_factor_enabled ? 'on' : 'off')
const codes = ref<string[]>([])
const code = ref('')
const busy = ref(false)
const problem = ref<string | null>(null)

const enabled = computed(() => view.value === 'on' || view.value === 'turning_off' || view.value === 'required')

async function fromIdentity() {
  await onSignedIn()
  view.value = identity.value?.two_factor_enabled ? 'on' : 'off'
}

async function enrolFailed(error: unknown) {
  if (twoFactorConflict(error) === 'off') {
    view.value = 'not_offered'
    return
  }
  if (await expire(error, '/account/security')) return
  problem.value = sentenceFor(error)
  // `token_spent` here means an authenticator is on already: the shown state was stale.
  await fromIdentity()
}

function enrolled(recoveryCodes: string[]) {
  codes.value = recoveryCodes
  view.value = 'codes'
}

async function turnOff() {
  busy.value = true
  problem.value = null
  try {
    await client.auth.disableTwoFactor(code.value)
    await fromIdentity()
  } catch (error) {
    const conflict = twoFactorConflict(error)
    if (conflict === 'required') view.value = 'required'
    else if (conflict === 'off') await fromIdentity()
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
        <UPageCard title="Two-factor authentication" description="A code from an authenticator app at every sign-in, after your password or emailed code." variant="subtle">
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3 text-sm">
              <UBadge :color="enabled ? 'success' : 'neutral'" variant="subtle" :label="enabled ? 'On' : 'Off'" />
              <span v-if="view === 'required'" class="text-muted">Required by {{ starter.name }}</span>
              <span v-else-if="view === 'not_offered'" class="text-muted">{{ starter.name }} does not offer two-factor.</span>
            </div>

            <UButton
              v-if="view === 'off'"
              label="Set up"
              class="w-fit"
              @click="view = 'enrolling'"
            />
            <AuthTotpEnroll v-else-if="view === 'enrolling'" @confirmed="enrolled" @failed="enrolFailed" />
            <AuthRecoveryCodes v-else-if="view === 'codes'" :codes="codes" @done="fromIdentity" />
            <UButton
              v-else-if="view === 'on'"
              label="Turn off"
              color="error"
              variant="outline"
              class="w-fit"
              @click="view = 'turning_off'"
            />
            <form v-else-if="view === 'turning_off'" class="flex flex-col gap-4 max-w-xs" @submit.prevent="turnOff">
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
