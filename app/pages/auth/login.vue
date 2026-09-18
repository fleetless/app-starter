<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const route = useRoute()

function next(): string {
  const raw = route.query.next
  // Only a path inside this app; a full URL here would be an open redirect.
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/robots'
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
