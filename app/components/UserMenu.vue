<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const { identity, signOut } = useSession()

const label = computed(() => identity.value?.email ?? 'Signed in')

const items = computed<DropdownMenuItem[][]>(() => ([[{
  type: 'label',
  label: label.value
}], [{
  label: 'Account',
  icon: 'i-lucide-user',
  to: '/account'
}, {
  label: 'Connected AI tools',
  icon: 'i-lucide-plug',
  to: '/account/connections'
}], [{
  label: 'Appearance',
  icon: 'i-lucide-sun-moon',
  // Three checkboxes read as a radio group: each ticks on the stored
  // preference, not on the theme in force, so System is never ticked twice.
  children: [{
    label: 'System',
    icon: 'i-lucide-monitor',
    type: 'checkbox',
    checked: colorMode.preference === 'system',
    onSelect(e: Event) {
      e.preventDefault()
      colorMode.preference = 'system'
    }
  }, {
    label: 'Light',
    icon: 'i-lucide-sun',
    type: 'checkbox',
    checked: colorMode.preference === 'light',
    onSelect(e: Event) {
      e.preventDefault()
      colorMode.preference = 'light'
    }
  }, {
    label: 'Dark',
    icon: 'i-lucide-moon',
    type: 'checkbox',
    checked: colorMode.preference === 'dark',
    onSelect(e: Event) {
      e.preventDefault()
      colorMode.preference = 'dark'
    }
  }]
}], [{
  label: 'Sign out',
  icon: 'i-lucide-log-out',
  onSelect: () => {
    signOut()
  }
}]]))
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      icon="i-lucide-circle-user"
      :label="collapsed ? undefined : label"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />
  </UDropdownMenu>
</template>
