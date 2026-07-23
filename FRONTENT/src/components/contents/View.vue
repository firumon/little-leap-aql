<template>
  <!-- Loading -->
  <div v-if="!rec && loading" class="flex flex-center q-py-lg">
    <q-spinner-dots color="primary" size="40px" />
  </div>

  <!-- Empty state -->
  <q-card v-else-if="!rec" flat bordered class="page-card aql-premium-gradient-card">
    <q-card-section class="text-center text-grey-7 q-pa-lg">
      <q-icon name="inbox" size="32px" class="q-mb-sm" />
      <div>Record not found.</div>
    </q-card-section>
  </q-card>

  <!-- Sections -->
  <div v-else>
    <div
      v-for="(section, index) in visibleSections"
      :key="section"
      class="rv-section"
      :style="{ animationDelay: `${index * 60}ms` }"
    >
      <ViewRecord
        v-if="section === 'Details'"
        v-bind="detailsProps"
      />
      <ViewParent v-else-if="section === 'Parent'" v-bind="attrs" />
      <ViewChildren v-else-if="section === 'Children'" v-bind="attrs" />
      <ViewAudit v-else-if="section === 'Audit'" v-bind="attrs" />
    </div>
  </div>
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import ViewRecord from 'components/contents/ViewRecord.vue'
import ViewParent from 'components/contents/ViewParent.vue'
import ViewChildren from 'components/contents/ViewChildren.vue'
import ViewAudit from 'components/contents/ViewAudit.vue'

defineOptions({ name: 'ContentsView', inheritAttrs: false })

const attrs = useAttrs()

const props = defineProps({
  order: { type: Array, default: null },
  hide: { type: Array, default: () => [] },
  detailsConfig: { type: Object, default: () => ({}) }
})

const {
  scope,
  resourceName,
  resourceSlug,
  resolvedFields,
  customUIName
} = inject('resourceConfig')
const {
  record: rec,
  childResources,
  loading
} = inject('resourceRecord')

const isMaster = computed(() => scope.value?.toLowerCase() === 'master')

const defaultOrder = computed(() =>
  isMaster.value
    ? ['Details', 'Children', 'Parent']
    : ['Details', 'Children', 'Parent', 'Audit']
)

const order = computed(() =>
  Array.isArray(props.order) && props.order.length ? props.order : defaultOrder.value
)

const hasAnyParent = computed(() => {
  const r = rec.value
  if (!r) return false
  const pKeys = r._Parents || []
  return pKeys.some((key) => r[key] != null)
})

const hasChildren = computed(() => (childResources?.value?.length || 0) > 0)

const hasAudit = computed(() => !!(rec.value?.CreatedAt || rec.value?.UpdatedAt))

const visibleSections = computed(() =>
  order.value.filter((section) => {
    if (props.hide.includes(section)) return false
    switch (section) {
      case 'Details': return !!rec.value
      case 'Parent': return hasAnyParent.value
      case 'Children': return hasChildren.value
      case 'Audit': return hasAudit.value
      default: return false
    }
  })
)

const detailsProps = computed(() => ({
  ...attrs,
  record: rec.value,
  resolvedFields: resolvedFields?.value ?? null,
  resourceName: resourceName.value,
  resourceSlug: resourceSlug.value,
  scope: scope.value,
  uiName: customUIName.value,
  detailsConfig: props.detailsConfig,
  showCodeLink: false
}))
</script>

<style scoped>
@keyframes rv-section-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.rv-section {
  animation: rv-section-in 260ms ease-out both;
}
</style>
