<script setup lang="ts">
import { safeNext } from '~/utils/routes'

definePageMeta({ layout: 'auth' })
const route = useRoute()

const next = computed(() => safeNext(route.query.next))
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Sign in
    </h1>
    <AuthLoginForm :next="next" @signed-in="navigateTo(next)" />
  </div>
</template>
