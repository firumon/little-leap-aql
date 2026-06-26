<template>
  <q-card flat bordered class="page-card q-mt-sm">
    <q-card-section>
      <div class="section-title">Details</div>
      <div class="detail-grid">
        <div v-for="field in detailFields" :key="field.header" class="detail-line items-center">
          <span class="detail-key">{{ field.label }}</span>
          <span class="detail-val col overflow-hidden flex justify-end">
            <template v-if="field.type === 'file' && record?.[field.header]">
              <AqlFilePreviewCard
                class="full-width"
                style="max-width: 280px"
                :uuid="record[field.header]"
                :resource-name="resourceName"
                :column-name="field.header"
              />
            </template>
            <template v-else>
              {{ record?.[field.header] || '-' }}
            </template>
          </span>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, inject } from 'vue'
import AqlFilePreviewCard from 'components/shared/AqlFilePreviewCard.vue'
import { deriveActionStampHeaders, filterDetailFields } from 'src/utils/appHelpers'

const props = defineProps({
  record: { type: Object, default: null },
  resolvedFields: { type: Array, default: () => [] },
  resourceName: { type: String, required: true }
})

const { additionalActions } = inject('resourceConfig')

const actionStampHeaders = computed(() => {
  return deriveActionStampHeaders(additionalActions.value || [])
})

const detailFields = computed(() => {
  return filterDetailFields(props.resolvedFields, actionStampHeaders.value)
})
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
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
