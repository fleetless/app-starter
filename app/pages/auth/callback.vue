<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const problem = ref<string | null>(null)

onMounted(async () => {
  const returned = await useOidcReturn('/auth/callback')
  if (returned.signedIn) {
    await navigateTo(returned.next)
    return
  }
  // No code, no error: this page is only ever a destination for a provider,
  // and an address bar that reached it by hand wants the login page.
  if (!returned.problem) {
    await navigateTo('/auth/login')
    return
  }
  problem.value = returned.problem
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">
      Signing in
    </h1>
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
    <p v-else class="text-sm text-muted">
      One moment.
    </p>
    <UButton
      v-if="problem"
      to="/auth/login"
      label="Back to sign in"
      variant="outline"
    />
  </div>
</template>
