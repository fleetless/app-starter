<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { starter } = useAppConfig()
const open = ref(false)

const links = [[{
  label: 'Robots',
  icon: 'i-lucide-bot',
  to: '/robots',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Account',
  icon: 'i-lucide-user',
  to: '/account',
  onSelect: () => {
    open.value = false
  }
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <!-- Two files per mark, swapped by the theme: an <img> is a picture,
           and no CSS in this document recolours what is inside it. -->
      <template #header="{ collapsed }">
        <template v-if="collapsed">
          <img
            :src="starter.brand.icon.light"
            :alt="starter.name"
            height="22"
            class="size-[22px] shrink-0 dark:hidden"
          >
          <img
            :src="starter.brand.icon.dark"
            :alt="starter.name"
            height="22"
            class="hidden size-[22px] shrink-0 dark:block"
          >
        </template>
        <template v-else>
          <img
            :src="starter.brand.logo.light"
            :alt="starter.name"
            height="22"
            class="h-[22px] w-auto shrink-0 dark:hidden"
          >
          <img
            :src="starter.brand.logo.dark"
            :alt="starter.name"
            height="22"
            class="hidden h-[22px] w-auto shrink-0 dark:block"
          >
        </template>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
