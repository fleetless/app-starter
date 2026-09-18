<script setup lang="ts">
const { starter } = useAppConfig()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-elevated/25">
    <div class="w-full max-w-sm flex flex-col gap-6">
      <!-- The light file is dark ink, the dark file light ink; an <img> takes
           no colour from the page. -->
      <img :src="starter.brand.logo.light" :alt="starter.name" class="h-6 w-auto self-center dark:hidden">
      <img :src="starter.brand.logo.dark" :alt="starter.name" class="hidden h-6 w-auto self-center dark:block">
      <UCard>
        <slot />
      </UCard>
    </div>
  </div>
</template>
