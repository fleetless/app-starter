<script setup lang="ts">
import type { CollectionRecord } from '@fleetless/sdk'

const props = defineProps<{ robotId: string }>()
const { entries, canCreate, defined, categories, loaded, listed, failed, problem, add, reload } = useLogbook(props.robotId)

const text = ref('')
const category = ref<string | undefined>(undefined)
const adding = ref(false)

// The schema's first category until the person picks another. A select cannot
// stand empty, and an entry without a category is rarely the one meant.
watch(categories, (next) => {
  if (!next.some(c => c.value === category.value)) category.value = next[0]?.value
}, { immediate: true })

async function submit() {
  if (text.value.trim() === '') return
  adding.value = true
  try {
    await add(text.value.trim(), category.value)
  } finally {
    adding.value = false
  }
  // `add` reports its refusal through `problem`; the text stays for another try.
  if (!problem.value) text.value = ''
}

// Values are `unknown` on the wire: the schema says text, the screen checks.
const textOf = (entry: CollectionRecord) => typeof entry.values.text === 'string' ? entry.values.text : ''
const categoryOf = (entry: CollectionRecord) => {
  const value = entry.values.category
  return typeof value === 'string' ? (categories.value.find(c => c.value === value)?.label ?? value) : null
}
const when = (entry: CollectionRecord) => new Date(entry.created_at).toLocaleString()
</script>

<template>
  <div class="flex flex-col gap-3">
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      :title="problem"
    />
    <UButton
      v-if="failed"
      label="Try again"
      color="neutral"
      variant="outline"
      class="self-start"
      @click="reload"
    />
    <p v-if="!loaded" class="text-sm text-muted">
      Loading the logbook.
    </p>
    <template v-else-if="!defined && !problem">
      <p class="text-sm">
        No logbook yet. Publish collections.yaml to add one.
      </p>
      <UButton
        label="Check again"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="reload"
      />
    </template>
    <template v-else-if="defined">
      <p class="text-sm text-muted">
        What people have written down about this robot, newest first. The latest 50 show here.
      </p>
      <UForm
        v-if="canCreate"
        :state="{ text, category }"
        class="flex flex-col gap-3"
        @submit="submit"
      >
        <UFormField name="text" label="Entry">
          <UTextarea
            v-model="text"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <div class="flex items-end gap-3">
          <UFormField v-if="categories.length" name="category" label="Category">
            <USelect
              v-model="category"
              :items="categories"
              class="w-44"
            />
          </UFormField>
          <UButton
            type="submit"
            label="Add entry"
            :loading="adding"
            :disabled="text.trim() === ''"
          />
        </div>
      </UForm>
      <p v-if="listed && entries.length === 0" class="text-sm">
        Nothing written yet.
      </p>
      <UCard v-for="entry in entries" :key="entry.id">
        <div class="flex items-baseline justify-between gap-3 text-xs text-muted">
          <span>{{ when(entry) }} · {{ entry.created_by.label }}</span>
          <UBadge
            v-if="categoryOf(entry)"
            color="neutral"
            variant="subtle"
          >
            {{ categoryOf(entry) }}
          </UBadge>
        </div>
        <p class="mt-2 text-sm whitespace-pre-wrap">
          {{ textOf(entry) }}
        </p>
      </UCard>
    </template>
  </div>
</template>
