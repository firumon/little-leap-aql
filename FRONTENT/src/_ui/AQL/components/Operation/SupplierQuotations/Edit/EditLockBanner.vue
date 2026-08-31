<template>
  <div v-if="locked">
    <q-banner dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      This quotation has been accepted or rejected, so nothing typed here will save.
    </q-banner>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuotationCaptureContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/useQuotationCaptureContext'
import { isEditable } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

defineOptions({ name: 'SupplierQuotationsEditLockBanner', inheritAttrs: false })


const { existing } = useQuotationCaptureContext()

const locked = computed(() => !!existing.value && !isEditable(existing.value))
</script>
