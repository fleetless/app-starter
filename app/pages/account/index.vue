<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { sentenceFor } from '~/utils/errors'

const client = useFleetless()
const { identity, expire } = useSession()
const toast = useToast()

const schema = z.object({
  current: z.string().min(1, 'Your current password.'),
  next: z.string().min(12, 'Twelve characters or more.')
})
type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({ current: '', next: '' })
const busy = ref(false)
const problem = ref<string | null>(null)

async function submit(event: FormSubmitEvent<Schema>) {
  busy.value = true
  problem.value = null
  try {
    await client.auth.changePassword(event.data.current, event.data.next)
    state.current = ''
    state.next = ''
    toast.add({ title: 'Password changed. Every other session was signed out.' })
  } catch (error) {
    if (!(await expire(error, '/account'))) problem.value = sentenceFor(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="account">
    <template #header>
      <UDashboardNavbar title="Account">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 w-full lg:max-w-2xl mx-auto">
        <UPageCard title="Who you are" variant="subtle">
          <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt class="text-muted">
              Email
            </dt>
            <dd>{{ identity?.email }}</dd>
            <dt class="text-muted">
              Kind
            </dt>
            <dd>{{ identity?.kind }}</dd>
            <dt class="text-muted">
              App
            </dt>
            <dd class="font-mono">
              {{ identity?.app_id }}
            </dd>
          </dl>
        </UPageCard>

        <UPageCard title="Password" description="Your current password is needed, so a session alone cannot take the account over." variant="subtle">
          <UForm
            :schema="schema"
            :state="state"
            class="flex flex-col gap-4 max-w-xs"
            @submit="submit"
          >
            <UFormField name="current">
              <UInput
                v-model="state.current"
                type="password"
                placeholder="Current password"
                autocomplete="current-password"
                class="w-full"
              />
            </UFormField>
            <UFormField name="next">
              <UInput
                v-model="state.next"
                type="password"
                placeholder="New password"
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
              label="Change password"
              type="submit"
              class="w-fit"
              :loading="busy"
            />
          </UForm>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
