<template>
  <div v-if="!isPaid && hasPendingOutletPayments">
    <SectionDividerLabel label="PENDING PAYMENTS FOR THIS OUTLET" />

    <q-card flat bordered :class="ui.cardClass">
      <q-list separator>
        <q-item v-for="payment in outletPendingPayments" :key="payment.Code">
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ payment.Code }}</q-item-label>
            <q-item-label caption>
              {{ payment.Date }} · {{ payment.Mode }} · {{ payment.Username }}
            </q-item-label>
          </q-item-section>

          <q-item-section side class="items-end">
            <div class="text-weight-bold">{{ money(payment.Amount) }}</div>
            <q-btn
              flat
              no-caps
              color="positive"
              icon="check_circle"
              label="Approve"
              @click="approve(payment.Code)"
            />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </div>
</template>

<script setup>
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewPendingPaymentsNotice', inheritAttrs: false })

const {
  ui,
  isPaid,
  outletPendingPayments,
  hasPendingOutletPayments,
  money,
  nav
} = useInvoiceViewContext()

const approve = (code) => nav.goTo('action', { code, action: 'approve' })
</script>
