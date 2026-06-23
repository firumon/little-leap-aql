<template>
  <div v-if="!resolversReady" class="q-py-md text-center">
    <q-spinner-dots color="primary" size="24px" />
  </div>
  <template v-else>
    <component
      v-for="(resolver, index) in childResolvers"
      :key="childResources[index].name"
      :is="resolver.component"
      :child-resource="childResources[index]"
      :child-records="childRecordsMap[childResources[index].name] || []"
      :additional-actions="additionalActions"
      @view-child="(childRes, code) => $emit('view-child', childRes, code)"
    />
  </template>
</template>

<script setup>
import { ref, watch, markRaw, computed } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { registry } from 'src/composables/resources/useSectionResolver'
import OperationViewChild from 'components/_common/View/Child.vue'

const props = defineProps({
  childResources: { type: Array, default: () => [] },
  childRecordsMap: { type: Object, default: () => ({}) },
  parentCode: { type: String, default: '' },
  resourceSlug: { type: String, default: '' },
  customUIName: { type: String, default: '' },
  entityName: { type: String, default: '' },
  additionalActions: { type: Array, default: () => [] }
})

defineEmits(['view-child'])

const childResolvers = ref([])
const resolversReady = ref(false)

async function resolveChildComponents() {
  resolversReady.value = false
  const resolvers = []
  const entityName = props.entityName || toPascalCase(props.resourceSlug)
  const customUIName = props.customUIName
  const scopeFolder = 'Operations'

  for (const childRes of props.childResources) {
    const pascalChildName = toPascalCase(childRes.name)
    const candidates = []

    function addPaths(dir) {
      const legacyPrefix = 'OperationViewChild'
      if (pascalChildName) {
        candidates.push(`${dir}/Child${pascalChildName}.vue`)
        candidates.push(`${dir}/${legacyPrefix}${pascalChildName}.vue`)
      }
      candidates.push(`${dir}/Child.vue`)
      candidates.push(`${dir}/${legacyPrefix}.vue`)
    }

    if (customUIName) {
      addPaths(`components/_custom/${customUIName}/${scopeFolder}/${entityName}/View`)
      addPaths(`components/_custom/${customUIName}/${scopeFolder}/${entityName}`)
      addPaths(`components/_custom/${customUIName}/${scopeFolder}/View`)
      addPaths(`components/_custom/${customUIName}/View`)
      addPaths(`components/_custom/${customUIName}/${scopeFolder}`)
      addPaths(`components/_custom/${customUIName}`)
    }

    addPaths(`components/${scopeFolder}/${entityName}/View`)
    addPaths(`components/${scopeFolder}/${entityName}`)
    addPaths(`components/_common/${scopeFolder}/View`)
    addPaths(`components/_common/${scopeFolder}`)
    addPaths(`components/_common/View`)
    addPaths(`components/_common`)

    let resolvedComponent = null
    for (const path of candidates) {
      if (registry[path]) {
        try {
          const mod = await registry[path]()
          resolvedComponent = markRaw(mod.default || mod)
          break
        } catch (e) {
          console.warn(`Failed to load custom child component at ${path}`, e)
        }
      }
    }

    resolvers.push({
      name: childRes.name,
      component: resolvedComponent || markRaw(OperationViewChild)
    })
  }

  childResolvers.value = resolvers
  resolversReady.value = true
}

watch(
  () => [props.childResources, props.entityName, props.customUIName],
  () => { resolveChildComponents() },
  { immediate: true, deep: true }
)
</script>
