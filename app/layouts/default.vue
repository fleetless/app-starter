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
      <template #header="{ collapsed }">
        <img
          :src="collapsed ? starter.brand.icon : starter.brand.logo"
          :alt="starter.name"
          height="22"
          :class="collapsed ? 'size-[22px] shrink-0' : 'h-[22px] w-auto shrink-0'"
        >
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
