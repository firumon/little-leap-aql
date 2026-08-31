<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-btn v-bind="BTN" icon="visibility" color="grey-7" aria-label="View quotation" @click.stop="goToView">
      <q-tooltip>View Quotation</q-tooltip>
    </q-btn>

    <q-btn v-if="canEdit" v-bind="BTN" icon="edit" color="primary" aria-label="Revise quotation" @click.stop="goToEdit">
      <q-tooltip>Revise Quotation</q-tooltip>
    </q-btn>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useProcurementIndexContext } from 'src/_ui/AQL/composables/Operation/useProcurementIndexContext'
import { isEditable } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

defineOptions({ name: 'SupplierQuotationsIndexQuotationActionButtons' })

const props = defineProps({
  item: { type: Object, required: true }
})

const { nav } = useProcurementIndexContext()

const BTN = { flat: true, round: true, dense: true, size: 'md' }

// Reject needs a written reason, so it stays on the record page.
const canEdit = computed(() => isEditable(props.item))

function goToEdit () {
  nav.goTo('edit', { code: props.item?.Code })
}

function goToView () {
  nav.goTo('view', { code: props.item?.Code })
}
</script>
