<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />
  <div v-else-if="finalProps.record?.CreatedAt || finalProps.record?.UpdatedAt">
    <SectionDividerLabel label="Audit" />
    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div class="aql-detail-grid">
          <div v-if="finalProps.record.CreatedAt" class="aql-detail-line">
            <span class="aql-detail-key">Created</span>
            <span class="aql-detail-val">{{ formatDate(finalProps.record.CreatedAt) }}</span>
          </div>
          <div v-if="finalProps.record.UpdatedAt" class="aql-detail-line">
            <span class="aql-detail-key">Updated</span>
            <span class="aql-detail-val">{{ formatDate(finalProps.record.UpdatedAt) }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'CommonAudit' })

const props = defineProps({
  page: { type: String, default: 'View' }
})

const { record } = inject('resourceRecord')

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Audit',
  page: props.page
})

const preparedProps = computed(() => ({
  record: record.value
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))

function formatDate(value) {
  if (!value) return '-'
  try {
    const d = new Date(typeof value === 'number' ? value : Number(value) || value)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(value) }
}
</script>
