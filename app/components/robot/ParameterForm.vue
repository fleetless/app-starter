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

const validate = (values: Record<string, unknown>): FormError[] => [
  ...validateValues(fields.value, values),
  ...(props.fieldErrors ?? [])
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
      <USelect
        v-else-if="field.kind === 'enum'"
        v-model="state[field.name] as string"
        :items="(field.options ?? []).map(String)"
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
