<template>
  <div v-if="parentRecordsList.length">
    <div v-for="item in parentRecordsList" :key="item.key">
      <SectionDividerLabel :label="resolveTitle(item)" />
      <q-card flat bordered class="page-card aql-premium-gradient-card">
        <q-card-section>
          <!-- Parent Card Details Grid -->
          <div class="aql-detail-grid">
            <!-- First row: Code on the left, navigation launch icon on the right -->
            <div class="aql-detail-line">
              <span class="aql-detail-key">Code</span>
              <span class="aql-detail-val">
                <span>{{ item.parentRecord.Code }}</span>
                <q-btn flat round dense color="primary" icon="open_in_new" size="sm" @click="navigateToParent(item.parentResource, item.parentRecord)" class="q-ml-sm">
                  <q-tooltip>Open {{ resolveTitle(item) }}</q-tooltip>
                </q-btn>
              </span>
            </div>

            <!-- Other parent fields -->
            <div v-for="(val, key) in getDisplayedFields(item.parentRecord)" :key="key" class="aql-detail-line">
              <span class="aql-detail-key">{{ humanizeString(key) }}</span>
              <span class="aql-detail-val">{{ val || '-' }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { humanizeString, deriveActionStampHeaders, filterParentFields } from 'src/utils/appHelpers'

defineOptions({ name: 'CommonParent' })

defineProps({
  parentConfig: {
    type: Object,
    default: () => ({})
  }
})

const nav = useResourceNav()
const authStore = useAuthStore()
const dataStore = useDataStore()

const { additionalActions, scope, resourceName } = inject('resourceConfig')
const { record } = inject('resourceRecord')

function singularize(name) {
  if (!name) return ''
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y'
  if (name.endsWith('es') && !name.endsWith('ces') && !name.endsWith('ses')) return name.slice(0, -2)
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1)
  return name
}

function getResourceSlug(res) {
  if (res.slug) return res.slug
  const route = res.ui?.menus?.[0]?.route || res.Menu?.[0]?.route
  if (route) {
    const parts = route.split('/')
    return parts[parts.length - 1]
  }
  return (res.name || '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

const parentRecordsList = computed(() => {
  const pKeys = record.value?._Parents || []
  const relations = dataStore.getRelations(resourceName.value)
  const allResources = Array.isArray(authStore.resources) ? authStore.resources : []

  const list = []
  for (const key of pKeys) {
    const pRecord = record.value?.[key]
    if (!pRecord) continue

    const singular = key.slice(1).toLowerCase() // e.g. 'product', 'uom', 'tax'

    // Find parent resource name
    let parentResName = null
    const parentMatch = relations.parents.find(p => p.singular.toLowerCase() === singular)
    if (parentMatch) {
      parentResName = parentMatch.resourceName
    } else {
      // Check linkRefs
      for (const [codeField, refResource] of Object.entries(relations.linkRefs)) {
        if (singularize(refResource).toLowerCase() === singular) {
          parentResName = refResource
          break
        }
      }
    }

    if (!parentResName) {
      // Fallback
      parentResName = singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`
    }

    const pRes = allResources.find(r => r.name.toLowerCase() === parentResName.toLowerCase())
    if (pRes) {
      list.push({
        key,
        parentRecord: pRecord,
        parentResource: pRes
      })
    }
  }
  return list
})

const actionStampHeaders = computed(() => deriveActionStampHeaders(additionalActions.value || []))

function resolveTitle(item) {
  const resName = item.parentResource.name || ''
  return humanizeString(singularize(resName))
}

function getDisplayedFields(pRecord) {
  const baseFields = filterParentFields(pRecord, actionStampHeaders.value) || {}
  return baseFields
}

function navigateToParent(pRes, pRec) {
  console.log('navigateToParent', pRes, pRec)
  const rSlug = getResourceSlug(pRes)
  if (rSlug && pRec?.Code) {
    const scope = pRes.scope || scope.value
    nav.goTo('view', {
      scope: scope,
      resourceSlug: rSlug,
      code: pRec.Code
    })
  }
}
</script>
