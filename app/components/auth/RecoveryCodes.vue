<script setup lang="ts">
const props = defineProps<{ codes: string[] }>()
const emit = defineEmits<{ done: [] }>()
const toast = useToast()
const saved = ref(false)
const text = computed(() => `${props.codes.join('\n')}\n`)

async function copy() {
  await navigator.clipboard.writeText(text.value)
  toast.add({ title: 'Copied.' })
}

function download() {
  const url = URL.createObjectURL(new Blob([text.value], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'recovery-codes.txt'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <ul class="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
      <li v-for="code in codes" :key="code">
        {{ code }}
      </li>
    </ul>
    <div class="flex gap-2">
      <UButton
        label="Copy"
        color="neutral"
        variant="outline"
        class="grow justify-center"
        @click="copy"
      />
      <UButton
        label="Download .txt"
        color="neutral"
        variant="outline"
        class="grow justify-center"
        @click="download"
      />
    </div>
    <UCheckbox v-model="saved" label="I saved my recovery codes" />
    <UButton
      label="Continue"
      block
      :disabled="!saved"
      @click="emit('done')"
    />
  </div>
</template>
