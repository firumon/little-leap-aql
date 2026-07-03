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
      :child-records="childRecordsByResource[childResources[index].name] || []"
      :additional-actions="additionalActions"
      @view-child="handleViewChild"
    />
  </template>
</template>

<script setup>
import { ref, watch, markRaw, computed, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'
import { registry } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import DefaultChild from 'components/_common/sections/Content/Child.vue'

defineOptions({ name: 'ViewChildren' })

const nav = useResourceNav()

const { scope, resourceSlug, customUIName, resourceName, additionalActions } = inject('resourceConfig')
const { childResources, childRecordsByResource } = inject('resourceRecord')

const childResolvers = ref([])
const resolversReady = ref(false)

async function resolveChildComponents() {
  resolversReady.value = false
  const resolvers = []
  const entityName = toPascalCase(resourceSlug.value)
  const customUI = customUIName.value
  const scopeFolder = toPascalCase(scope.value || 'masters')

  for (const childRes of childResources.value) {
    const pascalChildName = toPascalCase(childRes.name)
    const candidates = []

    function addPaths(dir) {
      const legacyPrefix = scopeFolder === 'Operation' ? 'OperationViewChild' : 'MasterViewChild'
      if (pascalChildName) {
        candidates.push(`${dir}/Child${pascalChildName}.vue`)
        candidates.push(`${dir}/${legacyPrefix}${pascalChildName}.vue`)
      }
      candidates.push(`${dir}/Child.vue`)
      candidates.push(`${dir}/${legacyPrefix}.vue`)
    }

    if (customUI) {
      addPaths(`components/_custom/${customUI}/${scopeFolder}/${entityName}/View`)
      addPaths(`components/_custom/${customUI}/${scopeFolder}/${entityName}`)
      addPaths(`components/_custom/${customUI}/${scopeFolder}/View`)
      addPaths(`components/_custom/${customUI}/View`)
      addPaths(`components/_custom/${customUI}/${scopeFolder}`)
      addPaths(`components/_custom/${customUI}`)
    }

    addPaths(`components/${scopeFolder}/${entityName}/View`)
    addPaths(`components/${scopeFolder}/${entityName}`)
    addPaths(`components/_common/${scopeFolder}/View`)
    addPaths(`components/_common/${scopeFolder}`)
    addPaths(`components/_common/View`)
    addPaths(`components/_common/sections/Content`)

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
      component: resolvedComponent || markRaw(DefaultChild)
    })
  }

  childResolvers.value = resolvers
  resolversReady.value = true
}

function handleViewChild(childResource, childCode) {
  nav.goTo('view', {
    scope: childResource.scope || scope.value,
    resourceSlug: childResource.slug,
    code: childCode
  })
}

watch(
  () => [childResources.value, resourceSlug.value, customUIName.value, scope.value],
  () => { resolveChildComponents() },
  { immediate: true, deep: true }
)
</script>
