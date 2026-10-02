<template>
  <q-card v-if="outletCode" flat bordered :class="ui.cardClass">
    <q-card-section>
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">Auto-approve payment</div>
          <div class="text-caption text-grey-8">Immediately approve this payment upon recording.</div>
        </div>
        <div class="col-auto">
          <q-toggle
            v-model="autoApprove"
            color="primary"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'

defineOptions({ name: 'OutletPaymentsAddAutoApproveToggle', inheritAttrs: false })

const { pageState, ui, syncAllocations } = useOutletPaymentAddContext()

const payment = pageState.useNode('OutletPayments')
const outletCode = computed(() => payment.node.value?.record?.OutletCode)

const autoApprove = pageState.useControls('AutoApprove', false)

watch(autoApprove, (isApprove) => {
  if (!isApprove) {
    syncAllocations({})
  }
})
</script>
