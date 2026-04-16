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
import OperationViewChild from './OperationViewChild.vue'

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

const customModules = import.meta.glob('../_custom/**/*.vue')
const entityModules = import.meta.glob('../*/*.vue')

async function resolveChildComponents() {
  resolversReady.value = false
  const resolvers = []
  const entityName = props.entityName || toPascalCase(props.resourceSlug)
  const customUIName = props.customUIName

  for (const childRes of props.childResources) {
    const pascalChildName = toPascalCase(childRes.name)
    const pathsToTry = []

    if (customUIName) {
      pathsToTry.push(`../_custom/${customUIName}/${entityName}/OperationViewChild${pascalChildName}.vue`)
      pathsToTry.push(`../_custom/${customUIName}/${entityName}/OperationViewChild.vue`)
      pathsToTry.push(`../_custom/${customUIName}/OperationViewChild.vue`)
    }

    pathsToTry.push(`../${entityName}/OperationViewChild${pascalChildName}.vue`)
    pathsToTry.push(`../${entityName}/OperationViewChild.vue`)

    let resolvedComponent = null
    for (const path of pathsToTry) {
      const modules = path.includes('_custom') ? customModules : entityModules
      if (modules[path]) {
        try {
          const mod = await modules[path]()
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
