<script setup lang="ts">
import { safeNext } from '~/utils/routes'

definePageMeta({ layout: 'auth' })
const route = useRoute()

const next = computed(() => safeNext(route.query.next))
const expired = computed(() => route.query.reason === 'expired')
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Sign in
    </h1>
    <UAlert
      v-if="expired"
      color="warning"
      variant="subtle"
      title="That sign-in step expired. Sign in again."
    />
    <AuthLoginForm :next="next" @signed-in="navigateTo(next)" />
  </div>
</template>
