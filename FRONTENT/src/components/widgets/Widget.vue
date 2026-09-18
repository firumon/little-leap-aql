<template>
  <component
    :is="resolved.component"
    v-if="resolved.component"
    v-bind="mergedProps"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps || {}" />
    </template>
  </component>
  <div v-else-if="resolved.error" class="text-negative text-caption q-pa-xs">
    {{ resolved.error }}
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { presetOf } from './presetOf.js'

defineOptions({
  name: 'AqlWidget',
  inheritAttrs: false
})

const props = defineProps({
  name: {
    type: String,
    default: null
  },
  base: {
    type: String,
    default: null
  },
  preset: {
    type: Object,
    default: null
  }
})

const attrs = useAttrs()

const baseModules = import.meta.glob('./abstract/*.vue', { eager: true })

const bases = {}
for (const [path, mod] of Object.entries(baseModules)) {
  const match = path.match(/\.\/abstract\/(\w+Base)\.vue$/)
  if (match) {
    bases[match[1]] = mod.default || mod
  }
}

const resolved = computed(() => {
  const { name, base: propBase, preset: propPreset } = props

  if (!name && !propPreset && !propBase) {
    return { component: null, presetProps: {}, error: 'No widget found' }
  }

  let preset = null
  if (propPreset) {
    preset = propPreset
  } else if (name) {
    preset = presetOf(name)
    if (!preset) {
      return { component: null, presetProps: {}, error: `No widget: ${name}` }
    }
  }

  const baseKey = propBase ?? preset?.base
  if (!baseKey || !bases[baseKey]) {
    return {
      component: null,
      presetProps: {},
      error: `No base: ${baseKey || name || ''}`
    }
  }

  return {
    component: bases[baseKey],
    presetProps: preset?.props || {},
    error: null
  }
})

const mergedProps = computed(() => {
  return { ...(resolved.value.presetProps || {}), ...attrs }
})
</script>
