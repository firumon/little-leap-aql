<template>
  <component
    :is="resolvedParentDisplay"
    v-if="resolvedParentDisplay && parentResource && parentRecord"
    :parent-resource="parentResource"
    :parent-record="parentRecord"
    :additional-actions="additionalActions"
    :scope="scope"
    :resource-slug="resourceSlug"
    :custom-u-i-name="customUIName"
    :entity-name="entityName"
    :parent-config="parentConfig"
  />
  <q-card v-else-if="parentResource && parentRecord" flat bordered class="page-card q-mt-sm">
    <q-card-section>
      <div class="section-title">{{ resolvedTitle }}</div>

      <!-- Case A: hasName = true and no custom fields requested -->
      <div v-if="hasName && !activeConfig.fields" class="detail-grid">
        <div class="detail-line">
          <span class="detail-key">{{ humanizedParentName }}</span>
          <span
            class="detail-val text-primary cursor-pointer text-weight-bold"
            @click="navigateToParent"
          >
            {{ parentRecord?.Name || '-' }} ({{ parentRecord?.Code || '-' }})
          </span>
        </div>
      </div>

      <!-- Case B: hasName = false or custom fields explicitly requested -->
      <div v-else class="detail-grid">
        <div v-for="(val, key) in displayedFields" :key="key" class="detail-line">
          <span class="detail-key">{{ humanizeString(key) }}</span>
          <span class="detail-val">{{ val || '-' }}</span>
        </div>
        <div class="q-mt-md flex justify-end">
          <q-btn flat color="primary" :label="resolvedActionLabel" icon-right="arrow_forward" @click="navigateToParent" />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, ref, watch, markRaw, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { humanizeString, toPascalCase, deriveActionStampHeaders, filterParentFields } from 'src/utils/appHelpers'

defineOptions({ name: 'CommonParent' })

const props = defineProps({
  parentConfig: {
    type: Object,
    default: () => ({})
  }
})

const nav = useResourceNav()

const { additionalActions, scope, resourceSlug, customUIName, resourceName } = inject('resourceConfig')
const { parentResource, record } = inject('resourceRecord')

const parentRecord = computed(() => {
  const pKeys = record.value?._Parents || []
  if (pKeys.length) return record.value?.[pKeys[0]] || null
  return null
})

const entityName = computed(() => toPascalCase(resourceSlug.value))

// 6-tier resolution
const resolvedParentDisplay = ref(null)
const customModules = import.meta.glob('../_custom/**/*.vue')
const entityModules = import.meta.glob('../*/*.vue')

async function resolveComponent() {
  if (!parentResource.value) {
    resolvedParentDisplay.value = null
    return
  }

  const pascalParentName = toPascalCase(parentResource.value.name || '')
  const entName = entityName.value
  const customUI = customUIName.value

  const pathsToTry = []

  if (customUI) {
    pathsToTry.push(`../_custom/${customUI}/${entName}/MasterViewParent${pascalParentName}.vue`)
    pathsToTry.push(`../_custom/${customUI}/${entName}/MasterViewParent.vue`)
    pathsToTry.push(`../_custom/${customUI}/MasterViewParent.vue`)
  }

  pathsToTry.push(`../${entName}/MasterViewParent${pascalParentName}.vue`)
  pathsToTry.push(`../${entName}/MasterViewParent.vue`)

  for (const path of pathsToTry) {
    const modules = path.includes('_custom') ? customModules : entityModules
    if (modules[path]) {
      try {
        const mod = await modules[path]()
        resolvedParentDisplay.value = markRaw(mod.default || mod)
        return
      } catch (e) {
        console.warn(`Failed to load custom parent component at ${path}`, e)
      }
    }
  }

  resolvedParentDisplay.value = null // Render default self
}

watch(
  () => [parentResource.value, entityName.value, customUIName.value],
  () => { resolveComponent() },
  { immediate: true }
)

const actionStampHeaders = computed(() => deriveActionStampHeaders(additionalActions.value || []))

const humanizedParentName = computed(() => {
  return humanizeString(parentResource.value?.name || '')
})

const hasName = computed(() => {
  return parentRecord.value && !!parentRecord.value.Name
})

const filteredParentFields = computed(() => {
  return filterParentFields(parentRecord.value, actionStampHeaders.value)
})

const activeConfig = computed(() => {
  return {
    title: undefined,
    fields: null,
    actionLabel: undefined,
    ...(props.parentConfig || {})
  }
})

const resolvedTitle = computed(() => {
  if (activeConfig.value.title !== undefined) return activeConfig.value.title
  return hasName.value ? 'Parent' : humanizedParentName.value
})

const resolvedActionLabel = computed(() => {
  if (activeConfig.value.actionLabel !== undefined) return activeConfig.value.actionLabel
  return `View ${humanizedParentName.value}`
})

const displayedFields = computed(() => {
  const baseFields = filteredParentFields.value || {}
  if (activeConfig.value.fields) {
    const res = {}
    activeConfig.value.fields.forEach((k) => {
      res[k] = parentRecord.value?.[k]
    })
    return res
  }
  return baseFields
})

function navigateToParent() {
  if (parentResource.value && parentRecord.value?.Code) {
    nav.goTo('view', {
      scope: parentResource.value.scope || scope.value,
      resourceSlug: parentResource.value.slug,
      code: parentRecord.value.Code
    })
  }
}
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--aql-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
.detail-grid { display: grid; gap: 0; }
.detail-line { display: flex; justify-content: space-between; gap: 16px; padding: 10px 2px; border-bottom: 1px dashed #e2e8f0; }
.detail-line:last-child { border-bottom: none; }
.detail-key { color: #64748b; font-size: 13px; }
.detail-val { color: #1f2937; font-size: 13px; text-align: right; font-weight: 500; }
.cursor-pointer { cursor: pointer; }
.text-primary { color: var(--q-primary); }
.text-weight-bold { font-weight: 600; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>

