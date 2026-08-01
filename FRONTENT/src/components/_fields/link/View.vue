<template>
  <a
    v-if="href"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="text-primary flex items-center no-wrap"
  >
    <span class="ellipsis">{{ label }}</span>
    <q-icon name="open_in_new" size="14px" class="q-ml-xs" />
  </a>
  <span v-else>{{ emptyText }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldLinkView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' }
})

// Raw model value drives the href; a modifier-supplied displayValue only
// relabels the anchor (so `ViewColumn<Header>.js` can shorten long URLs).
const rawValue = computed(() => {
  const raw = model.value
  return raw == null ? '' : String(raw).trim()
})

const href = computed(() => {
  const raw = rawValue.value
  if (!raw || raw === '-') return ''
  return /^[a-z][a-z0-9+.-]*:|^\/\//i.test(raw) ? raw : `https://${raw}`
})

const label = computed(() => {
  const display = props.config?.displayValue
  if (display != null && String(display).trim() !== '' && String(display).trim() !== '-') {
    return display
  }
  return rawValue.value
})
</script>
