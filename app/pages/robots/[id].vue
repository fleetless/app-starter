<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { exposuresOf, tabsFor, type TabKey } from '~/utils/datasheet'

const route = useRoute()
const robotId = typeof route.params.id === 'string' ? route.params.id : ''
const { sheet, loading, problem, reload } = useDatasheet(robotId)

const tabs = computed(() => sheet.value ? tabsFor(sheet.value) : [])
const items = computed<TabsItem[]>(() => tabs.value.map(t => ({ label: t.count === null ? t.label : `${t.label} (${t.count})`, value: t.key })))
const active = ref<TabKey | undefined>(undefined)
// A reload can withdraw the open tab; land on the first one the sheet still grants.
watch(tabs, (next) => {
  if (!next.some(t => t.key === active.value)) active.value = next[0]?.key
}, { immediate: true })

onMounted(reload)
</script>

<template>
  <UDashboardPanel :id="`robot-${robotId}`">
    <template #header>
      <UDashboardNavbar :title="sheet?.robot_name ?? 'Robot'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="loading"
            @click="reload"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar v-if="items.length">
        <UTabs
          v-model="active"
          :items="items"
          :content="false"
          variant="link"
          class="-mx-1"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        :title="problem"
      />
      <div v-else-if="sheet && tabs.length === 0" class="text-sm text-muted max-w-prose">
        <p class="font-medium text-default">
          Nothing published for this robot yet.
        </p>
        <p>Once its configuration is published in the console and your role grants something on it, the tabs appear here.</p>
      </div>
      <template v-else-if="sheet">
        <div v-if="active === 'datapoints'" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <RobotDatapointCard
            v-for="e in exposuresOf(sheet, 'datapoint')"
            :key="e.slug"
            :robot-id="robotId"
            :exposure="e"
          />
        </div>
        <div v-else-if="active === 'actions'" class="grid gap-4 lg:grid-cols-2">
          <RobotCommandPanel
            v-for="e in exposuresOf(sheet, 'action')"
            :key="e.slug"
            :robot-id="robotId"
            :exposure="e"
          />
        </div>
        <div v-else-if="active === 'services'" class="grid gap-4 lg:grid-cols-2">
          <RobotCommandPanel
            v-for="e in exposuresOf(sheet, 'service')"
            :key="e.slug"
            :robot-id="robotId"
            :exposure="e"
          />
        </div>
        <div v-else-if="active === 'publishers'" class="grid gap-4 lg:grid-cols-2">
          <RobotCommandPanel
            v-for="e in exposuresOf(sheet, 'publisher')"
            :key="e.slug"
            :robot-id="robotId"
            :exposure="e"
          />
        </div>
        <div v-else-if="active === 'cameras'" class="grid gap-4 lg:grid-cols-2">
          <RobotCameraPanel
            v-for="e in exposuresOf(sheet, 'camera')"
            :key="e.slug"
            :robot-id="robotId"
            :exposure="e"
          />
        </div>
        <RobotJobHistory v-else-if="active === 'activity'" :robot-id="robotId" />
        <RobotAssetList v-else-if="active === 'assets'" :robot-id="robotId" />
      </template>
    </template>
  </UDashboardPanel>
</template>
