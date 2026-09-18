<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import { fieldsFrom, initialValues, toParams, validateValues } from '~/utils/json-schema-form'

const props = defineProps<{
  schema: unknown
  submitLabel: string
  busy?: boolean
  /** Server-side refusals per field (`parameter_invalid`), shown beside the local ones. */
  fieldErrors?: { name: string, message: string }[]
}>()
const emit = defineEmits<{ submit: [params: Record<string, unknown>] }>()

const fields = computed(() => fieldsFrom(props.schema))
const state = reactive<Record<string, unknown>>(initialValues(fields.value))
watch(fields, next => Object.assign(state, initialValues(next)))

// The parent's refusals, held here because they have to expire on their own:
// `UForm` withholds the submit event while any error stands, so a parent-owned
// error the parent can only clear on the next submit would lock the form
// shut. The first edit makes the server's verdict stale, and it goes.
// This watch compares `fieldErrors` by reference: a parent that mutates its
// own array in place is never heard. Assign a new one — `fieldErrorsFrom`
// returns one, and clearing means `[]`, not `length = 0`.
const serverErrors = ref<{ name: string, message: string }[]>([])
watch(() => props.fieldErrors, (next) => {
  serverErrors.value = next ?? []
}, { immediate: true })
watch(state, () => {
  serverErrors.value = []
}, { deep: true })

const validate = (values: Record<string, unknown>): FormError[] => [
  ...validateValues(fields.value, values),
  ...serverErrors.value
]

function submit() {
  emit('submit', toParams(fields.value, state))
}
</script>

<template>
  <UForm
    :state="state"
    :validate="validate"
    class="flex flex-col gap-3"
    @submit="submit"
  >
    <UFormField
      v-for="field in fields"
      :key="field.name"
      :name="field.name"
      :label="field.name"
      :description="field.description"
      :required="field.required"
    >
      <USwitch v-if="field.kind === 'boolean'" v-model="state[field.name] as boolean" />
      <!-- Each option keeps its own type: the cloud checks `enum.includes`,
           which is SameValueZero, so a stringified "2" is refused for an
           integer enum and a numeric default matches no item. -->
      <USelect
        v-else-if="field.kind === 'enum'"
        v-model="state[field.name] as string | number"
        :items="(field.options ?? []).map(v => ({ label: String(v), value: v }))"
        class="w-full"
      />
      <UTextarea
        v-else-if="field.kind === 'json'"
        v-model="state[field.name] as string"
        :rows="3"
        placeholder="{ … }"
        class="w-full font-mono"
      />
      <UInput
        v-else
        v-model="state[field.name] as string"
        :type="field.kind === 'string' ? 'text' : 'number'"
        :min="field.min"
        :max="field.max"
        :step="field.kind === 'integer' ? 1 : 'any'"
        class="w-full"
      />
    </UFormField>
    <p v-if="fields.length === 0" class="text-xs text-muted">
      No parameters.
    </p>
    <UButton
      type="submit"
      :label="submitLabel"
      :loading="busy"
      class="w-fit"
    />
  </UForm>
</template>
