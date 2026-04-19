<template>
  <component
    v-if="resolvedParentDisplay && parentResource && parentRecord"
    :is="resolvedParentDisplay"
    :parent-resource="parentResource"
    :parent-record="parentRecord"
    :additional-actions="additionalActions"
    :scope="scope"
    :resource-slug="resourceSlug"
    :custom-u-i-name="customUIName"
    :entity-name="entityName"
  />
  <q-card v-else-if="parentResource && parentRecord" flat bordered class="page-card q-mt-sm">
    <q-card-section>
      <div class="section-title">{{ hasName ? 'Parent' : humanizedParentName }}</div>

      <!-- Case A: hasName = true -->
      <div v-if="hasName" class="detail-grid">
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

      <!-- Case B: hasName = false -->
      <div v-else class="detail-grid">
        <div v-for="(val, key) in filteredParentFields" :key="key" class="detail-line">
          <span class="detail-key">{{ humanizeString(key) }}</span>
          <span class="detail-val">{{ val || '-' }}</span>
        </div>
        <div class="q-mt-md flex justify-end">
          <q-btn flat color="primary" :label="`View ${humanizedParentName}`" icon-right="arrow_forward" @click="navigateToParent" />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, ref, watch, markRaw } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { humanizeString, toPascalCase, deriveActionStampHeaders, filterParentFields } from 'src/utils/appHelpers'

const nav = useResourceNav()

const props = defineProps({
  parentResource: { type: Object, default: null },
  parentRecord: { type: Object, default: null },
  additionalActions: { type: Array, default: () => [] },
  scope: { type: String, default: 'operations' },
  resourceSlug: { type: String, default: '' },
  customUIName: { type: String, default: '' },
  entityName: { type: String, default: '' }
})

// 6-tier resolution
const resolvedParentDisplay = ref(null)
const customModules = import.meta.glob('../_custom/**/*.vue')
const entityModules = import.meta.glob('../*/*.vue')

async function resolveComponent() {
  if (!props.parentResource) {
    resolvedParentDisplay.value = null
    return
  }

  const pascalParentName = toPascalCase(props.parentResource.name || '')
  const entityName = props.entityName || toPascalCase(props.resourceSlug)
  const customUIName = props.customUIName

  const pathsToTry = []

  if (customUIName) {
    pathsToTry.push(`../_custom/${customUIName}/${entityName}/OperationViewParent${pascalParentName}.vue`)
    pathsToTry.push(`../_custom/${customUIName}/${entityName}/OperationViewParent.vue`)
    pathsToTry.push(`../_custom/${customUIName}/OperationViewParent.vue`)
  }

  pathsToTry.push(`../${entityName}/OperationViewParent${pascalParentName}.vue`)
  pathsToTry.push(`../${entityName}/OperationViewParent.vue`)

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
  () => [props.parentResource, props.entityName, props.customUIName],
  () => { resolveComponent() },
  { immediate: true }
)

const actionStampHeaders = computed(() => deriveActionStampHeaders(props.additionalActions))

const humanizedParentName = computed(() => {
  return humanizeString(props.parentResource?.name || '')
})

const hasName = computed(() => {
  return props.parentRecord && !!props.parentRecord.Name
})

const filteredParentFields = computed(() => {
  return filterParentFields(props.parentRecord, actionStampHeaders.value)
})

function navigateToParent() {
  if (props.parentResource && props.parentRecord?.Code) {
    nav.goTo('view', {
      scope: props.parentResource.scope || props.scope,
      resourceSlug: props.parentResource.slug,
      code: props.parentRecord.Code
    })
  }
}
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
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
.text-primary { color: var(--operation-primary, #0f766e); }
.text-weight-bold { font-weight: 600; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
