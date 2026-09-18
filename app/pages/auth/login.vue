<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const route = useRoute()

function next(): string {
  const raw = route.query.next
  // Only a path inside this app. A second leading separator of either kind
  // (`//host`, `/\host`) reads as external to the router, which throws here
  // instead of navigating — so both fall back to the same place.
  return typeof raw === 'string' && raw.startsWith('/') && !/^\/[/\\]/.test(raw) ? raw : '/robots'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Sign in
    </h1>
    <AuthLoginForm @signed-in="navigateTo(next())" />
  </div>
</template>
