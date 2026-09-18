<script setup lang="ts">
const { starter } = useAppConfig()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-elevated/25">
    <div class="w-full max-w-sm flex flex-col gap-6">
      <img :src="starter.brand.logo" :alt="starter.name" class="h-6 w-auto self-center">
      <UCard>
        <slot />
      </UCard>
    </div>
  </div>
</template>
