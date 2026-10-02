<script setup lang="ts">
/**
 * Six boxes for a six-digit code. The model is a string, never a number:
 * a code may start with zero, and `012345` is not `12345`.
 */
const model = defineModel<string>({ required: true })
defineProps<{ disabled?: boolean }>()

const cells = computed<string[]>({
  get: () => model.value.split(''),
  set: (value) => {
    model.value = value.join('').replace(/\D/g, '').slice(0, 6)
  }
})
</script>

<template>
  <UPinInput
    v-model="cells"
    :length="6"
    otp
    type="text"
    inputmode="numeric"
    :disabled="disabled"
    aria-label="Six-digit code"
  />
</template>
