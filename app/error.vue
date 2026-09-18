<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

// Whatever reaches this page says what did not happen, never what the server
// or the network said: `statusMessage` is ours, `message` is not.
const sentence = computed(() => props.error.statusMessage || 'The request did not go through.')

useSeoMeta({
  title: 'Something went wrong.',
  description: sentence
})

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center p-4 bg-elevated/25">
      <div class="w-full max-w-sm flex flex-col gap-4">
        <h1 class="text-lg font-semibold">
          Something went wrong.
        </h1>
        <p class="text-sm text-muted">
          {{ sentence }}
        </p>
        <UButton
          label="Back home"
          variant="outline"
          class="w-fit"
          @click="clearError({ redirect: '/' })"
        />
      </div>
    </div>
  </UApp>
</template>
